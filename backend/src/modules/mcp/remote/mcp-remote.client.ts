import { createHash } from 'node:crypto';
import { AppError } from '../../../shared/errors/app-error';
import { validateMcpRemoteEgress, type McpRemoteHostResolver } from './mcp-remote-egress';
import { getMcpRemoteConfig } from './mcp-remote.config';
import { evaluateMcpRemoteReadOnly } from './mcp-remote-readonly-policy';
import {
  FailClosedMcpRemoteClientTransport,
  type McpRemoteClientTransport,
  type McpRemoteClientTransportContext,
} from './mcp-remote-transport';
import type {
  GovernedMcpToolExecutionResult,
  GovernedMcpToolExecutionSpec,
  McpRemoteClientErrorCode,
  McpRemoteClientOptions,
  McpRemoteFeatureConfig,
  McpRemoteReadOnlyBlockedReason,
  McpRemoteReadiness,
  McpToolDiscoveryRequest,
  McpToolDiscoveryResult,
} from './mcp-remote.types';

const unsafeOptionKeyFragments = ['authorization', 'cookie', 'password', 'privatekey', 'token', 'apikey', 'credentialvalue'];
const sensitiveTextPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;

function assertNoRawCredentialKeys(options: Record<string, unknown>) {
  for (const key of Object.keys(options)) {
    const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
    if (
      unsafeOptionKeyFragments.some((fragment) => normalized.includes(fragment))
      || (normalized.includes('secret') && normalized !== 'secretref')
      || (normalized.includes('credential') && normalized !== 'credentialsconfigured')
    ) {
      throw new AppError(422, 'MCP_REMOTE_RAW_CREDENTIAL_REJECTED', 'MCP remote client accepts logical references only, not raw credentials.');
    }
  }
}

function validSecretRef(value: string | null | undefined) {
  if (!value) return undefined;
  const normalized = value.trim();
  if (
    normalized.length > 240
    || /[\s@?#]/.test(normalized)
    || !/^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9/_.:-]+$/i.test(normalized)
  ) {
    throw new AppError(422, 'MCP_REMOTE_SECRET_REF_INVALID', 'MCP remote secret reference is invalid.');
  }
  return normalized;
}

function clientError(code: McpRemoteClientErrorCode, message: string) {
  return new AppError(409, code, message);
}

function sanitizedTransportFailure(error: unknown): never {
  if (error instanceof AppError) throw error;
  throw clientError('MCP_REMOTE_TRANSPORT_FAILED', 'MCP remote transport failed.');
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, controller: AbortController) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(clientError('MCP_REMOTE_TIMEOUT', 'MCP remote operation timed out.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface McpRemoteClientDependencies {
  transport?: McpRemoteClientTransport;
  resolveHost?: McpRemoteHostResolver;
}

export class McpRemoteClient {
  readonly serverId: string;
  readonly baseUrl: string | null;
  readonly authType: string;
  readonly credentialsConfigured: boolean;
  readonly timeoutMs: number;
  private readonly config: McpRemoteFeatureConfig;
  private readonly secretRef?: string;
  private readonly transport: McpRemoteClientTransport;
  private readonly resolveHost?: McpRemoteHostResolver;

  constructor(
    options: McpRemoteClientOptions,
    config: McpRemoteFeatureConfig = getMcpRemoteConfig(),
    dependencies: McpRemoteClientDependencies = {},
  ) {
    assertNoRawCredentialKeys(options as unknown as Record<string, unknown>);
    this.serverId = options.serverId;
    this.baseUrl = options.baseUrl ?? null;
    this.authType = options.authType ?? 'none';
    this.secretRef = validSecretRef(options.secretRef);
    this.credentialsConfigured = Boolean(options.credentialsConfigured || this.secretRef);
    this.timeoutMs = Math.min(options.timeoutMs, config.maxTimeoutMs);
    this.config = config;
    this.transport = dependencies.transport ?? new FailClosedMcpRemoteClientTransport();
    this.resolveHost = dependencies.resolveHost;
  }

  private assertRemoteEnabled() {
    if (!this.config.remoteEnabled) {
      throw clientError('MCP_REMOTE_DISABLED', 'MCP remote is disabled by backend configuration.');
    }
  }

  private async transportContext(): Promise<{ context: McpRemoteClientTransportContext; host: string }> {
    if (!this.baseUrl) throw clientError('MCP_REMOTE_EGRESS_BLOCKED', 'MCP remote destination is missing.');
    if (this.authType !== 'none' && this.config.requireSecretRef && !this.secretRef) {
      throw clientError('MCP_REMOTE_SECRET_REF_REQUIRED', 'MCP remote authentication requires a logical secret reference.');
    }
    const target = await validateMcpRemoteEgress(this.baseUrl, this.config.egressAllowlist, this.resolveHost);
    const controller = new AbortController();
    return {
      host: target.host,
      context: {
        serverId: this.serverId,
        baseUrl: this.baseUrl,
        authType: this.authType,
        ...(this.secretRef ? { credentialRef: this.secretRef } : {}),
        timeoutMs: this.timeoutMs,
        signal: controller.signal,
      },
    };
  }

  async checkHealth(readiness?: McpRemoteReadiness): Promise<McpRemoteReadiness> {
    this.assertRemoteEnabled();
    if (readiness && readiness.status !== 'ready') throw clientError('MCP_REMOTE_POLICY_BLOCKED', readiness.reason);
    const { context } = await this.transportContext();
    const controller = new AbortController();
    try {
      const health = await withTimeout(
        this.transport.checkHealth({ ...context, signal: controller.signal }),
        this.timeoutMs,
        controller,
      );
      if (health.status !== 'healthy' || typeof health.simulated !== 'boolean') {
        throw clientError('MCP_REMOTE_TRANSPORT_FAILED', 'MCP remote health response was invalid.');
      }
    } catch (error) {
      sanitizedTransportFailure(error);
    }
    return readiness ?? {
      status: 'ready',
      failClosed: false,
      remoteEnabled: true,
      discoveryEnabled: this.config.discoveryEnabled,
      executionEnabled: this.config.executionEnabled,
      serverId: this.serverId,
      reason: 'MCP remote health transport completed through the governed boundary.',
      checks: [],
      credentialsConfigured: this.credentialsConfigured,
      authType: this.authType,
      timeoutMs: this.timeoutMs,
    };
  }

  async discoverTools(request: McpToolDiscoveryRequest): Promise<McpToolDiscoveryResult> {
    this.assertRemoteEnabled();
    if (!this.config.discoveryEnabled) {
      throw clientError('MCP_REMOTE_DISCOVERY_DISABLED', 'MCP remote discovery is disabled by backend configuration.');
    }
    const { context } = await this.transportContext();
    const controller = new AbortController();
    try {
      return await withTimeout(
        this.transport.discoverTools({ ...context, signal: controller.signal, requestId: request.requestId }),
        Math.min(request.timeoutMs, this.timeoutMs),
        controller,
      );
    } catch (error) {
      return sanitizedTransportFailure(error);
    }
  }

  async executeTool(spec: GovernedMcpToolExecutionSpec): Promise<GovernedMcpToolExecutionResult> {
    const startedAt = Date.now();
    const evaluation = evaluateMcpRemoteReadOnly({
      config: this.config,
      tool: spec.tool,
      policy: spec.policyDecision,
      authType: this.authType,
      secretRef: this.secretRef,
    });
    if (!evaluation.allowed) {
      const errorByReason: Partial<Record<McpRemoteReadOnlyBlockedReason, McpRemoteClientErrorCode>> = {
        remote_disabled: 'MCP_REMOTE_DISABLED',
        execution_disabled: 'MCP_REMOTE_EXECUTION_DISABLED',
        readonly_disabled: 'MCP_REMOTE_READONLY_DISABLED',
        tool_not_readonly: 'MCP_REMOTE_TOOL_NOT_READONLY',
        dangerous_operation: 'MCP_REMOTE_TOOL_OPERATION_BLOCKED',
        secret_ref_required: 'MCP_REMOTE_SECRET_REF_REQUIRED',
      };
      const blockedReason = evaluation.blockedReason ?? 'runtime_execution_not_allowed';
      throw clientError(
        errorByReason[blockedReason] ?? 'MCP_REMOTE_POLICY_BLOCKED',
        'MCP remote read-only execution was blocked by governance policy.',
      );
    }

    const { context, host } = await this.transportContext();
    const controller = new AbortController();
    let output;
    try {
      output = await withTimeout(
        this.transport.executeReadonlyTool({
          ...context,
          signal: controller.signal,
          executionId: spec.executionId,
          toolName: spec.tool.externalName,
          input: spec.input.value,
        }),
        Math.min(spec.limits.timeoutMs, this.timeoutMs),
        controller,
      );
    } catch (error) {
      sanitizedTransportFailure(error);
    }

    const content = output.content.trim();
    const measuredBytes = Buffer.byteLength(content, 'utf8');
    const responseBytes = Math.max(measuredBytes, output.responseBytes);
    const responseLimit = Math.min(spec.limits.maxOutputBytes, this.config.maxResponseBytes);
    if (!Number.isSafeInteger(responseBytes) || responseBytes < measuredBytes || responseBytes > responseLimit) {
      throw clientError('MCP_REMOTE_RESPONSE_TOO_LARGE', 'MCP remote response exceeded the governed limit.');
    }
    if (!content || content.length > 1000 || sensitiveTextPattern.test(content)) {
      throw clientError('MCP_REMOTE_TRANSPORT_FAILED', 'MCP remote response failed safe-output validation.');
    }

    return {
      executionId: spec.executionId,
      status: 'completed',
      content,
      outputHash: createHash('sha256').update(content).digest('hex'),
      durationMs: Math.max(0, Date.now() - startedAt),
      externalMcpCalled: true,
      simulated: output.simulated,
      responseBytes,
      remoteHost: host,
      events: [{
        type: 'mcp.remote.readonly.completed',
        status: 'completed',
        message: 'Governed MCP remote read-only execution completed.',
        metadata: {
          mcpRemoteEvaluationApplied: true,
          mcpRemoteAllowed: true,
          mcpRemoteReadOnly: true,
          externalMcpCalled: true,
          simulated: output.simulated,
          responseBytes,
        },
      }],
      sanitizedMetadata: {
        mcpRemoteEvaluationApplied: true,
        mcpRemoteAllowed: true,
        mcpRemoteBlocked: false,
        mcpRemoteReadOnly: true,
        mcpRemoteHost: host,
        mcpRemoteToolId: spec.mcpToolId,
        mcpRemoteRiskLevel: spec.tool.riskLevel,
        externalMcpCalled: true,
        simulated: output.simulated,
        responseBytes,
      },
    };
  }
}
