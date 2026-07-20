import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import { recordAuditEvent } from '../audit/audit.service';
import { agentRunsRepository } from '../agent-runs/agent-runs.repository';
import type { AgentRunEventInput } from '../agent-runs/agent-runs.types';
import { mcpRepository } from '../mcp/mcp.repository';
import { McpRemoteClient } from '../mcp/remote/mcp-remote.client';
import { getMcpRemoteConfig } from '../mcp/remote/mcp-remote.config';
import { evaluateMcpRemoteReadOnly } from '../mcp/remote/mcp-remote-readonly-policy';
import type {
  McpRemoteClientOptions,
  McpRemoteFeatureConfig,
  McpRemoteReadOnlyBlockedReason,
} from '../mcp/remote/mcp-remote.types';
import {
  assistantRuntimeSpecV1Schema,
  runtimeToolGatewayResponseSchema,
} from './runtime-contract.schema';
import type {
  AssistantRuntimeSpecV1,
  RuntimeToolGatewayRequest,
  RuntimeToolGatewayResponse,
} from './runtime-contract.types';
import { getRuntimeToolGatewayConfig } from './runtime.tool-gateway.config';

interface GatewayRequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface CachedCall {
  requestHash: string;
  response: RuntimeToolGatewayResponse;
}

interface ActiveGatewayRun {
  spec: AssistantRuntimeSpecV1;
  provider: 'agno_http';
  assistantPublicationId: string | null;
  executed: number;
  calls: Map<string, CachedCall>;
  lock: Promise<void>;
}

type GatewayReason = NonNullable<RuntimeToolGatewayResponse['metadata']['reason']>;
type GatewayMetadataOverrides = Partial<Omit<RuntimeToolGatewayResponse['metadata'], 'toolCallsExecuted' | 'failedClosed' | 'latencyMs' | 'reason'>> & {
  mcpRemoteBlockedReason?: RuntimeToolGatewayResponse['metadata']['mcpRemoteBlockedReason'];
};

export interface RuntimeToolGatewayDependencies {
  createRemoteClient?: (
    options: McpRemoteClientOptions,
    config: McpRemoteFeatureConfig,
  ) => Pick<McpRemoteClient, 'executeTool'>;
}

const defaultDependencies: Required<RuntimeToolGatewayDependencies> = {
  createRemoteClient: (options, config) => new McpRemoteClient(options, config),
};

const activeRuns = new Map<string, ActiveGatewayRun>();

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function deterministicCallId(runId: string, runtimeToolCallId: string) {
  const hex = createHash('sha256').update(`${runId}:${runtimeToolCallId}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function payloadSize(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function blockedCode(reason: GatewayReason): NonNullable<RuntimeToolGatewayResponse['error']>['code'] {
  if (reason === 'gateway_disabled') return 'TOOL_GATEWAY_DISABLED';
  if (reason === 'run_unavailable' || reason === 'run_not_executable') return 'TOOL_CALL_RUN_UNAVAILABLE';
  if (reason === 'max_tool_calls_zero' || reason === 'max_tool_calls_exceeded' || reason === 'sequence_out_of_order') {
    return 'TOOL_CALL_LIMIT_EXCEEDED';
  }
  if (reason === 'invalid_arguments') return 'TOOL_CALL_INVALID_ARGUMENTS';
  if (reason === 'idempotency_conflict') return 'TOOL_CALL_IDEMPOTENCY_CONFLICT';
  if (reason === 'governance_failure') return 'TOOL_CALL_GOVERNANCE_FAILURE';
  if (reason === 'tool_not_in_spec' || reason === 'trace_mismatch' || reason === 'assistant_mismatch') {
    return 'TOOL_CALL_NOT_AUTHORIZED';
  }
  return 'TOOL_CALL_BLOCKED';
}

function blockedResponse(
  toolCallId: string,
  executed: number,
  reason: GatewayReason,
  startedAt: number,
  overrides: GatewayMetadataOverrides = {},
): RuntimeToolGatewayResponse {
  return runtimeToolGatewayResponseSchema.parse({
    toolCallId,
    status: 'blocked',
    error: {
      code: blockedCode(reason),
      message: 'Tool call blocked by governance policy.',
      retryable: false,
    },
    metadata: {
      toolCallsExecuted: executed,
      externalMcpCalled: false,
      simulated: true,
      failedClosed: true,
      reason,
      ...overrides,
      latencyMs: Math.max(0, Date.now() - startedAt),
    },
  });
}

function successResponse(
  toolCallId: string,
  executed: number,
  startedAt: number,
  content = 'Governed sandbox tool execution completed.',
  overrides: GatewayMetadataOverrides = {},
): RuntimeToolGatewayResponse {
  return runtimeToolGatewayResponseSchema.parse({
    toolCallId,
    status: 'succeeded',
    result: {
      content,
    },
    metadata: {
      toolCallsExecuted: executed,
      externalMcpCalled: false,
      simulated: true,
      failedClosed: false,
      ...overrides,
      latencyMs: Math.max(0, Date.now() - startedAt),
    },
  });
}

function publicEvent(
  type: string,
  status: string,
  message: string,
  metadata: Record<string, unknown>,
): AgentRunEventInput {
  return { type, status, message, metadata: metadata as Prisma.InputJsonValue };
}

function gatewayMetadata(executed: number, reason?: GatewayReason, overrides: GatewayMetadataOverrides = {}) {
  return {
    toolCallsExecuted: executed,
    externalMcpCalled: false,
    failedClosed: Boolean(reason),
    simulated: true,
    ...overrides,
    ...(reason ? { reason } : {}),
  };
}

async function recordBlocked(
  active: ActiveGatewayRun,
  context: GatewayRequestContext,
  reason: GatewayReason,
  overrides: GatewayMetadataOverrides = {},
) {
  const spec = active.spec;
  await Promise.allSettled([
    agentRunsRepository.appendEvents({
      id: spec.trace.runId,
      tenantId: spec.tenant.id,
      workspaceId: spec.workspace.id ?? '',
    }, [
      publicEvent('runtime.tool_requested', 'running', 'Runtime requested a governed tool call.', gatewayMetadata(active.executed, undefined, overrides)),
      publicEvent('runtime.tool_blocked', 'blocked', 'Tool call blocked by governance policy.', gatewayMetadata(active.executed, reason, overrides)),
    ]),
    recordAuditEvent({
      tenantId: spec.tenant.id,
      workspaceId: spec.workspace.id ?? undefined,
      actorUserId: spec.actor.userId,
      action: 'runtime_tool_gateway_blocked',
      entity: 'agent_run',
      entityId: spec.trace.runId,
      metadata: gatewayMetadata(active.executed, reason, overrides) as Prisma.InputJsonValue,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    }),
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function schemaNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

const commonSchemaKeys = new Set(['type', 'enum', 'const', 'title', 'description', 'default']);
const schemaKeysByType: Record<string, ReadonlySet<string>> = {
  string: new Set([...commonSchemaKeys, 'minLength', 'maxLength']),
  integer: new Set([...commonSchemaKeys, 'minimum', 'maximum']),
  number: new Set([...commonSchemaKeys, 'minimum', 'maximum']),
  boolean: commonSchemaKeys,
  array: new Set([...commonSchemaKeys, 'items', 'minItems', 'maxItems']),
  object: new Set([...commonSchemaKeys, 'properties', 'required', 'additionalProperties']),
};

function usesSupportedSchemaKeywords(schema: Record<string, unknown>) {
  const allowed = typeof schema.type === 'string' ? schemaKeysByType[schema.type] : undefined;
  return allowed ? Object.keys(schema).every((key) => allowed.has(key)) : false;
}

function validateSchemaShape(schema: unknown, depth = 0): schema is Record<string, unknown> {
  if (!isRecord(schema) || depth > 5) return false;
  if (!usesSupportedSchemaKeywords(schema)) return false;
  if ('enum' in schema && !Array.isArray(schema.enum)) return false;

  switch (schema.type) {
    case 'string': {
      const parsedMin = schemaNumber(schema.minLength);
      const parsedMax = schemaNumber(schema.maxLength);
      if (schema.minLength !== undefined && parsedMin === undefined) return false;
      if (schema.maxLength !== undefined && parsedMax === undefined) return false;
      const minLength = parsedMin ?? 0;
      const maxLength = parsedMax ?? 2000;
      return Number.isInteger(minLength) && minLength >= 0
        && Number.isInteger(maxLength) && maxLength >= minLength;
    }
    case 'integer':
    case 'number': {
      const minimum = schemaNumber(schema.minimum);
      const maximum = schemaNumber(schema.maximum);
      if (schema.minimum !== undefined && minimum === undefined) return false;
      if (schema.maximum !== undefined && maximum === undefined) return false;
      return minimum === undefined || maximum === undefined || minimum <= maximum;
    }
    case 'boolean':
      return true;
    case 'array': {
      const parsedMin = schemaNumber(schema.minItems);
      const parsedMax = schemaNumber(schema.maxItems);
      if (schema.minItems !== undefined && parsedMin === undefined) return false;
      if (schema.maxItems !== undefined && parsedMax === undefined) return false;
      const minItems = parsedMin ?? 0;
      const maxItems = parsedMax ?? 20;
      return Boolean(schema.items)
        && Number.isInteger(minItems)
        && minItems >= 0
        && Number.isInteger(maxItems)
        && maxItems >= minItems
        && validateSchemaShape(schema.items, depth + 1);
    }
    case 'object': {
      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) return false;
      const properties = isRecord(schema.properties) ? schema.properties : {};
      if ('properties' in schema && !isRecord(schema.properties)) return false;
      if ('required' in schema && (
        !Array.isArray(schema.required)
        || !schema.required.every((item) => typeof item === 'string')
      )) return false;
      const required = (schema.required ?? []) as string[];
      if (required.some((key) => !(key in properties))) return false;
      return Object.values(properties).every((property) => validateSchemaShape(property, depth + 1));
    }
    default:
      return false;
  }
}

function validateSchemaValue(value: unknown, schema: unknown, depth = 0): boolean {
  if (!validateSchemaShape(schema, depth)) return false;
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => stableJson(item) === stableJson(value))) return false;
  if ('const' in schema && stableJson(schema.const) !== stableJson(value)) return false;

  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') return false;
      const minLength = schemaNumber(schema.minLength) ?? 0;
      const maxLength = schemaNumber(schema.maxLength) ?? 2000;
      return value.length >= minLength && value.length <= Math.min(maxLength, 2000);
    }
    case 'integer': {
      if (!Number.isInteger(value)) return false;
      const minimum = schemaNumber(schema.minimum);
      const maximum = schemaNumber(schema.maximum);
      return (minimum === undefined || (value as number) >= minimum)
        && (maximum === undefined || (value as number) <= maximum);
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      const minimum = schemaNumber(schema.minimum);
      const maximum = schemaNumber(schema.maximum);
      return (minimum === undefined || value >= minimum)
        && (maximum === undefined || value <= maximum);
    }
    case 'boolean':
      return typeof value === 'boolean';
    case 'array': {
      if (!Array.isArray(value)) return false;
      const minItems = schemaNumber(schema.minItems) ?? 0;
      const maxItems = schemaNumber(schema.maxItems) ?? 20;
      return value.length >= minItems
        && value.length <= Math.min(maxItems, 20)
        && value.every((item) => validateSchemaValue(item, schema.items, depth + 1));
    }
    case 'object': {
      if (!isRecord(value)) return false;
      const properties = isRecord(schema.properties) ? schema.properties : {};
      const required = (schema.required ?? []) as string[];
      if (required.some((key) => !(key in value))) return false;
      if (Object.keys(value).some((key) => !(key in properties))) return false;
      return Object.entries(value).every(([key, item]) => validateSchemaValue(item, properties[key], depth + 1));
    }
    default:
      return false;
  }
}

function selectBinding(
  bindings: Awaited<ReturnType<typeof mcpRepository.listMatchingBindings>>,
  descriptor: AssistantRuntimeSpecV1['tools']['descriptors'][number],
  mode: 'sandbox_only' | 'enabled_placeholder',
) {
  const bindingId = descriptor.metadata?.bindingId;
  if (!bindingId) return null;
  return bindings.find((binding) => (
    binding.id === bindingId
    && binding.isEnabled
    && binding.mode === mode
    && (binding.mcpToolId === descriptor.toolId || binding.mcpToolId === null)
  )) ?? null;
}

interface GovernanceFailure {
  reason: GatewayReason;
  metadata?: GatewayMetadataOverrides;
}

interface GovernanceSuccess {
  tool: NonNullable<Awaited<ReturnType<typeof mcpRepository.findToolForExecution>>>;
  binding: Awaited<ReturnType<typeof mcpRepository.listMatchingBindings>>[number];
  remote: boolean;
}

function isRemoteServerType(value: string | null | undefined) {
  return value === 'remote' || value === 'external';
}

function readOnlyMetadata(value: unknown) {
  return isRecord(value) && value.readOnly === true;
}

function remoteGovernanceFailure(
  toolId: string,
  blockedReason: McpRemoteReadOnlyBlockedReason,
  readOnly = false,
): GovernanceFailure {
  return {
    reason: 'mcp_remote_policy_blocked',
    metadata: {
      externalMcpCalled: false,
      simulated: true,
      mcpRemoteEvaluationApplied: true,
      mcpRemoteAllowed: false,
      mcpRemoteBlocked: true,
      mcpRemoteReadOnly: readOnly,
      mcpRemoteBlockedReason: blockedReason,
      mcpRemoteToolId: toolId,
    },
  };
}

async function validateCurrentGovernance(
  active: ActiveGatewayRun,
  request: RuntimeToolGatewayRequest,
  descriptor: AssistantRuntimeSpecV1['tools']['descriptors'][number],
): Promise<GovernanceFailure | GovernanceSuccess> {
  const spec = active.spec;
  const workspaceId = spec.workspace.id;
  if (!workspaceId) return { reason: 'tool_policy_blocked' };

  const [assistant, tool] = await Promise.all([
    mcpRepository.findAssistantForExecution(spec.assistant.id, spec.tenant.id, [workspaceId]),
    mcpRepository.findToolForExecution(request.toolId, spec.tenant.id, [workspaceId]),
  ]);
  if (!assistant || !tool || assistant.workspaceId !== workspaceId || tool.workspaceId !== workspaceId) {
    return { reason: 'tool_policy_blocked' };
  }
  const executionPolicy = assistant.executionPolicy ?? await mcpRepository.getExecutionPolicy(assistant);
  if (
    assistant.status === 'archived'
    || !executionPolicy.isExecutionEnabled
    || !executionPolicy.sandboxEnabled
    || !executionPolicy.sandboxBlocksExternalTools
    || !executionPolicy.sandboxBlocksRealProviders
    || !executionPolicy.sandboxLogsRequired
  ) return { reason: 'tool_policy_blocked' };
  if (spec.assistant.status === 'published' && !executionPolicy.allowPublishedExecution) return { reason: 'tool_policy_blocked' };

  const bindings = await mcpRepository.listMatchingBindings(
    assistant.id,
    tool.mcpServerId,
    tool.id,
    spec.tenant.id,
    [workspaceId],
  );
  const remote = isRemoteServerType(tool.server.serverType);
  const readOnly = readOnlyMetadata(tool.metadata);
  const binding = selectBinding(bindings, descriptor, remote ? 'enabled_placeholder' : 'sandbox_only');
  const toolPolicy = tool.policies?.[0];
  if (
    !binding
    || tool.deletedAt
    || !tool.isEnabled
    || tool.server.deletedAt
    || tool.server.status !== 'active'
    || tool.server.trustLevel !== 'trusted'
  ) return remote
    ? remoteGovernanceFailure(tool.id, 'runtime_execution_not_allowed', readOnly)
    : { reason: 'tool_policy_blocked' };
  if (
    descriptor.approvalRequired
    || tool.requiresApproval
    || toolPolicy?.requiresApproval
    || binding.requiresApprovalOverride === true
  ) return remote
    ? remoteGovernanceFailure(tool.id, 'approval_required', readOnly)
    : { reason: 'approval_required' };
  if (descriptor.riskLevel !== 'low' || tool.riskLevel !== 'low' || (remote && tool.server.riskLevel !== 'low')) {
    return remote
      ? remoteGovernanceFailure(tool.id, 'risk_not_low', readOnly)
      : { reason: 'risk_not_low' };
  }
  if (!descriptor.inputSchema || !tool.inputSchema) return { reason: 'invalid_arguments' };
  if (sha256(descriptor.inputSchema) !== sha256(tool.inputSchema)) {
    return remote
      ? remoteGovernanceFailure(tool.id, 'runtime_execution_not_allowed', readOnly)
      : { reason: 'tool_policy_blocked' };
  }
  if (!validateSchemaValue(request.arguments, descriptor.inputSchema)) return { reason: 'invalid_arguments' };

  if (remote) {
    const evaluation = evaluateMcpRemoteReadOnly({
      config: getMcpRemoteConfig(),
      tool: {
        externalName: tool.name,
        displayName: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        metadata: tool.metadata,
        riskLevel: tool.riskLevel,
        requiresApproval: tool.requiresApproval,
        readOnly,
      },
      policy: {
        status: 'allowed',
        reasons: [],
        allowRuntimeExecution: toolPolicy?.allowRuntimeExecution === true,
        sandboxOnly: toolPolicy?.sandboxOnly === true,
        blockedByDefault: toolPolicy?.blockedByDefault !== false,
        approvalSatisfied: true,
      },
      authType: tool.server.authType,
      secretRef: tool.server.secretRef,
    });
    if (!evaluation.allowed) {
      return remoteGovernanceFailure(
        tool.id,
        evaluation.blockedReason ?? 'runtime_execution_not_allowed',
        evaluation.readOnly,
      );
    }
  } else if (toolPolicy?.sandboxOnly !== true) {
    return { reason: 'tool_policy_blocked' };
  }
  return { tool, binding, remote };
}

async function recordSuccess(
  active: ActiveGatewayRun,
  request: RuntimeToolGatewayRequest,
  context: GatewayRequestContext,
  governance: GovernanceSuccess,
  startedAt: number,
  dependencies: Required<RuntimeToolGatewayDependencies>,
) {
  const spec = active.spec;
  const workspaceId = spec.workspace.id!;
  const { tool, binding, remote } = governance;

  const executed = active.executed + 1;
  const internalCallId = deterministicCallId(spec.trace.runId, request.toolCallId);
  let content = 'Governed sandbox tool execution completed.';
  let metadataOverrides: GatewayMetadataOverrides = {};

  if (remote) {
    const remoteConfig = getMcpRemoteConfig();
    const client = dependencies.createRemoteClient({
      serverId: tool.server.id,
      baseUrl: tool.server.baseUrl,
      authType: tool.server.authType,
      secretRef: tool.server.secretRef,
      credentialsConfigured: Boolean(tool.server.secretRef),
      timeoutMs: Math.min(remoteConfig.defaultTimeoutMs, spec.policy.timeoutMs),
    }, remoteConfig);
    const remoteResult = await client.executeTool({
      executionId: internalCallId,
      tenantId: spec.tenant.id,
      workspaceId,
      assistantId: spec.assistant.id,
      assistantVersionId: spec.assistant.versionId ?? null,
      agentRunId: spec.trace.runId,
      mcpServerId: tool.mcpServerId,
      mcpToolId: tool.id,
      assistantMcpBindingId: binding.id,
      requestedByUserId: spec.actor.userId,
      mode: 'remote_controlled',
      requestId: context.requestId,
      traceId: spec.trace.traceId,
      tool: {
        externalName: tool.name,
        displayName: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        metadata: tool.metadata,
        riskLevel: 'low',
        requiresApproval: false,
        readOnly: true,
      },
      policyDecision: {
        status: 'allowed',
        reasons: [],
        allowRuntimeExecution: true,
        sandboxOnly: false,
        blockedByDefault: false,
        approvalSatisfied: true,
      },
      limits: {
        timeoutMs: Math.min(remoteConfig.defaultTimeoutMs, spec.policy.timeoutMs),
        maxInputBytes: getRuntimeToolGatewayConfig().maxPayloadBytes,
        maxOutputBytes: remoteConfig.maxResponseBytes,
      },
      input: {
        hash: sha256(request.arguments),
        value: request.arguments,
      },
    });
    if (remoteResult.status !== 'completed' || !remoteResult.content) {
      throw new AppError(409, 'MCP_REMOTE_TRANSPORT_FAILED', 'MCP remote read-only execution did not complete.');
    }
    content = remoteResult.content;
    metadataOverrides = {
      externalMcpCalled: remoteResult.externalMcpCalled,
      simulated: remoteResult.simulated,
      mcpRemoteEvaluationApplied: true,
      mcpRemoteAllowed: true,
      mcpRemoteBlocked: false,
      mcpRemoteReadOnly: true,
      mcpRemoteToolId: tool.id,
      mcpRemoteRiskLevel: 'low',
      ...(remoteResult.remoteHost ? { mcpRemoteHost: remoteResult.remoteHost } : {}),
      ...(remoteResult.responseBytes !== undefined ? { responseBytes: remoteResult.responseBytes } : {}),
    };
  }

  const durationMs = Math.max(0, Date.now() - startedAt);
  const metadata = gatewayMetadata(executed, undefined, metadataOverrides);
  const previousMetadata = gatewayMetadata(active.executed, undefined, remote ? {
    ...metadataOverrides,
    externalMcpCalled: false,
  } : {});
  const executionLabel = remote ? 'Governed MCP remote read-only execution' : 'Deterministic sandbox execution';
  await mcpRepository.createMcpToolCallWithEvents({
    id: internalCallId,
    tenantId: spec.tenant.id,
    workspaceId,
    assistantId: spec.assistant.id,
    assistantVersionId: spec.assistant.versionId ?? null,
    agentRunId: spec.trace.runId,
    mcpServerId: tool.mcpServerId,
    mcpToolId: tool.id,
    assistantMcpBindingId: binding.id,
    requestedByUserId: spec.actor.userId,
    mode: remote ? 'remote_controlled' : 'sandbox',
    status: 'completed',
    riskLevelSnapshot: 'low',
    approvalRequiredSnapshot: false,
    requestId: context.requestId,
    traceId: spec.trace.traceId,
    inputHash: sha256(request.arguments),
    policySnapshot: {
      sandboxOnly: !remote,
      externalMcpAllowed: remote,
      remoteReadOnly: remote,
      maxToolCalls: spec.policy.maxToolCalls,
      sequence: request.sequence,
    },
    metadata: metadata as Prisma.InputJsonValue,
    startedAt: new Date(startedAt),
    completedAt: new Date(),
    durationMs,
    events: [
      { type: 'precheck_started', message: 'Governed runtime tool precheck started.', metadata: previousMetadata as Prisma.InputJsonValue },
      { type: 'precheck_passed', message: 'Governed runtime tool precheck passed.', metadata: previousMetadata as Prisma.InputJsonValue },
      { type: 'execution_started', message: `${executionLabel} started.`, metadata: previousMetadata as Prisma.InputJsonValue },
      { type: 'execution_completed', message: `${executionLabel} completed.`, metadata: metadata as Prisma.InputJsonValue },
    ],
    agentRunEvents: [
      publicEvent('runtime.tool_requested', 'running', 'Runtime requested a governed tool call.', previousMetadata),
      publicEvent('runtime.tool_prechecked', 'running', 'Governed tool precheck passed.', previousMetadata),
      publicEvent('runtime.tool_executed', 'completed', `${executionLabel} completed.`, metadata),
      publicEvent('runtime.tool_result_returned', 'completed', 'Minimized tool result returned to runtime.', metadata),
    ],
  });

  active.executed = executed;
  await Promise.allSettled([recordAuditEvent({
    tenantId: spec.tenant.id,
    workspaceId,
    actorUserId: spec.actor.userId,
    action: remote ? 'runtime_tool_gateway_mcp_remote_readonly_executed' : 'runtime_tool_gateway_executed',
    entity: 'agent_run',
    entityId: spec.trace.runId,
    metadata: metadata as Prisma.InputJsonValue,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  })]);
  return successResponse(request.toolCallId, executed, startedAt, content, metadataOverrides);
}

async function withRunLock<T>(active: ActiveGatewayRun, operation: () => Promise<T>) {
  const previous = active.lock;
  let release!: () => void;
  active.lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function executeActive(
  active: ActiveGatewayRun,
  request: RuntimeToolGatewayRequest,
  context: GatewayRequestContext,
  dependencies: Required<RuntimeToolGatewayDependencies>,
): Promise<RuntimeToolGatewayResponse> {
  return withRunLock(active, async () => {
    const startedAt = Date.now();
    const requestHash = sha256(request);
    const cached = active.calls.get(request.toolCallId);
    if (cached) {
      if (cached.requestHash === requestHash) return cached.response;
      const response = blockedResponse(request.toolCallId, active.executed, 'idempotency_conflict', startedAt);
      await recordBlocked(active, context, 'idempotency_conflict');
      return response;
    }

    const block = async (reason: GatewayReason, overrides: GatewayMetadataOverrides = {}) => {
      const response = blockedResponse(request.toolCallId, active.executed, reason, startedAt, overrides);
      active.calls.set(request.toolCallId, { requestHash, response });
      await recordBlocked(active, context, reason, overrides);
      return response;
    };

    const config = getRuntimeToolGatewayConfig();
    if (payloadSize(request) > config.maxPayloadBytes) return block('invalid_arguments');
    const spec = active.spec;
    const workspaceId = spec.workspace.id;
    if (!workspaceId) return block('run_unavailable');
    const run = await agentRunsRepository.findToolGatewayRun(spec.trace.runId, spec.tenant.id, workspaceId);
    if (!run) return block('run_unavailable');
    if (run.status !== 'running' || run.mode !== 'published' && run.mode !== 'sandbox') return block('run_not_executable');
    if (active.provider !== 'agno_http') return block('run_not_executable');
    if (request.runtimeTraceId !== spec.trace.traceId || run.traceId !== spec.trace.traceId) return block('trace_mismatch');
    if (request.assistantId !== spec.assistant.id || run.assistantId !== spec.assistant.id) return block('assistant_mismatch');
    if (run.assistantVersionId !== (spec.assistant.versionId ?? null)) return block('assistant_mismatch');
    if (run.assistantPublicationId !== active.assistantPublicationId) return block('assistant_mismatch');
    if (run.mode === 'published' && !active.assistantPublicationId) return block('assistant_mismatch');

    const descriptor = spec.tools.descriptors.find((item) => item.toolId === request.toolId);
    if (!spec.tools.enabled || spec.tools.mode !== 'gateway' || !descriptor) return block('tool_not_in_spec');
    if (spec.policy.maxToolCalls === 0) return block('max_tool_calls_zero');
    if (active.executed >= spec.policy.maxToolCalls) return block('max_tool_calls_exceeded');
    if (request.sequence !== active.executed + 1) return block('sequence_out_of_order');

    const governance = await validateCurrentGovernance(active, request, descriptor);
    if ('reason' in governance) return block(governance.reason, governance.metadata);
    if (governance.remote && run.mode === 'sandbox') {
      const failure = remoteGovernanceFailure(request.toolId, 'sandbox_only', true);
      return block(failure.reason, failure.metadata);
    }

    try {
      const response = await recordSuccess(active, request, context, governance, startedAt, dependencies);
      active.calls.set(request.toolCallId, { requestHash, response });
      return response;
    } catch (error) {
      if (error instanceof AppError && error.code.startsWith('MCP_REMOTE_')) {
        const egressBlocked = error.code === 'MCP_REMOTE_EGRESS_BLOCKED';
        const blockedReasonByCode: Partial<Record<string, RuntimeToolGatewayResponse['metadata']['mcpRemoteBlockedReason']>> = {
          MCP_REMOTE_DISABLED: 'remote_disabled',
          MCP_REMOTE_EXECUTION_DISABLED: 'execution_disabled',
          MCP_REMOTE_READONLY_DISABLED: 'readonly_disabled',
          MCP_REMOTE_TOOL_NOT_READONLY: 'tool_not_readonly',
          MCP_REMOTE_TOOL_OPERATION_BLOCKED: 'dangerous_operation',
          MCP_REMOTE_SECRET_REF_REQUIRED: 'secret_ref_required',
          MCP_REMOTE_EGRESS_BLOCKED: 'egress_blocked',
        };
        return block(egressBlocked ? 'mcp_remote_egress_blocked' : (
          error.code === 'MCP_REMOTE_TRANSPORT_FAILED'
          || error.code === 'MCP_REMOTE_TIMEOUT'
          || error.code === 'MCP_REMOTE_NOT_IMPLEMENTED'
            ? 'mcp_remote_client_failed'
            : 'mcp_remote_policy_blocked'
        ), {
          externalMcpCalled: false,
          simulated: true,
          mcpRemoteEvaluationApplied: true,
          mcpRemoteAllowed: false,
          mcpRemoteBlocked: true,
          mcpRemoteReadOnly: true,
          mcpRemoteBlockedReason: blockedReasonByCode[error.code] ?? 'client_failed',
          mcpRemoteToolId: request.toolId,
        });
      }
      return block('governance_failure');
    }
  });
}

export function createRuntimeToolGatewayService(inputDependencies: RuntimeToolGatewayDependencies = {}) {
  const dependencies: Required<RuntimeToolGatewayDependencies> = {
    ...defaultDependencies,
    ...inputDependencies,
  };
  return {
    activateRun(specInput: AssistantRuntimeSpecV1, correlation: {
      provider: 'agno_http';
      assistantPublicationId: string | null;
    }) {
      const spec = assistantRuntimeSpecV1Schema.parse(specInput);
      activeRuns.set(spec.trace.runId, {
        spec,
        provider: correlation.provider,
        assistantPublicationId: correlation.assistantPublicationId,
        executed: 0,
        calls: new Map(),
        lock: Promise.resolve(),
      });
    },

    deactivateRun(runId: string) {
      activeRuns.delete(runId);
    },

    async execute(request: RuntimeToolGatewayRequest, context: GatewayRequestContext) {
      const startedAt = Date.now();
      const config = getRuntimeToolGatewayConfig();
      if (!config.enabled) return blockedResponse(request.toolCallId, 0, 'gateway_disabled', startedAt);
      const active = activeRuns.get(request.agentRunId);
      if (!active) return blockedResponse(request.toolCallId, 0, 'run_unavailable', startedAt);
      return executeActive(active, request, context, dependencies);
    },
  };
}

export const runtimeToolGatewayService = createRuntimeToolGatewayService();
