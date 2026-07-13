import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import {
  assistantRuntimeSpecV1Schema,
  runtimeToolGatewayService,
  type AssistantRuntimeSpecV1,
} from '../../src/modules/runtime';

const mocks = vi.hoisted(() => ({
  agentRunsRepository: {
    findToolGatewayRun: vi.fn(),
    appendEvents: vi.fn(),
  },
  mcpRepository: {
    findAssistantForExecution: vi.fn(),
    getExecutionPolicy: vi.fn(),
    findToolForExecution: vi.fn(),
    listMatchingBindings: vi.fn(),
    createMcpToolCallWithEvents: vi.fn(),
  },
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/agent-runs/agent-runs.repository', () => ({
  agentRunsRepository: mocks.agentRunsRepository,
}));

vi.mock('../../src/modules/mcp/mcp.repository', () => ({
  mcpRepository: mocks.mcpRepository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const versionId = '00000000-0000-0000-0000-000000000201';
const publicationId = '00000000-0000-0000-0000-000000000301';
const runId = '00000000-0000-0000-0000-000000000401';
const toolId = '00000000-0000-0000-0000-000000000501';
const serverId = '00000000-0000-0000-0000-000000000601';
const bindingId = '00000000-0000-0000-0000-000000000701';
const gatewayKey = 'phase16f-placeholder-security-key';
const traceId = 'trace_phase16f_gateway';

const originalEnv = {
  AGNO_RUNTIME_HTTP_ENABLED: env.AGNO_RUNTIME_HTTP_ENABLED,
  AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: env.AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY,
  AGNO_RUNTIME_HTTP_SECURITY_KEY: env.AGNO_RUNTIME_HTTP_SECURITY_KEY,
  AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: env.AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED,
  AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES: env.AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES,
};

function configureEnv(overrides: Partial<typeof originalEnv> = {}) {
  Object.assign(env, {
    ...originalEnv,
    AGNO_RUNTIME_HTTP_ENABLED: true,
    AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: true,
    AGNO_RUNTIME_HTTP_SECURITY_KEY: gatewayKey,
    AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: true,
    AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES: 32_768,
    ...overrides,
  });
}

function executionPolicy() {
  return {
    isExecutionEnabled: true,
    sandboxEnabled: true,
    sandboxBlocksExternalTools: true,
    sandboxBlocksRealProviders: true,
    sandboxLogsRequired: true,
    allowPublishedExecution: true,
  };
}

function assistantFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: assistantId,
    tenantId,
    workspaceId,
    status: 'published',
    executionPolicy: executionPolicy(),
    versions: [{ id: versionId }],
    ...overrides,
  };
}

function toolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: toolId,
    tenantId,
    workspaceId,
    mcpServerId: serverId,
    name: 'governed_lookup',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 120 },
      },
      required: ['query'],
    },
    riskLevel: 'low',
    requiresApproval: false,
    isEnabled: true,
    deletedAt: null,
    server: {
      id: serverId,
      status: 'active',
      trustLevel: 'trusted',
      deletedAt: null,
    },
    policies: [{ sandboxOnly: true, requiresApproval: false, allowRuntimeExecution: false, blockedByDefault: true }],
    ...overrides,
  };
}

function bindingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: bindingId,
    mcpToolId: toolId,
    isEnabled: true,
    mode: 'sandbox_only',
    requiresApprovalOverride: false,
    ...overrides,
  };
}

function runFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: versionId,
    assistantPublicationId: publicationId,
    requestedById: userId,
    status: 'running',
    mode: 'published',
    traceId,
    ...overrides,
  };
}

function specFixture(overrides: {
  maxToolCalls?: number;
  descriptor?: Record<string, unknown>;
} = {}): AssistantRuntimeSpecV1 {
  return assistantRuntimeSpecV1Schema.parse({
    specVersion: 'orchestra.runtime.assistant.v1',
    trace: { traceId, runId, requestId: 'req_phase16f' },
    tenant: { id: tenantId },
    workspace: { id: workspaceId },
    actor: { userId },
    assistant: { id: assistantId, versionId, status: 'published' },
    input: { message: 'Run a governed deterministic tool.' },
    model: { provider: 'local_deterministic', model: 'deterministic-sandbox' },
    policy: {
      executionMode: 'sync',
      streaming: false,
      timeoutMs: 15_000,
      maxToolCalls: overrides.maxToolCalls ?? 1,
      maxRagResults: 0,
      maxContextChars: 0,
      failClosed: true,
    },
    instructions: {},
    rag: { enabled: false, mode: 'none', sources: [] },
    tools: {
      enabled: true,
      mode: 'gateway',
      descriptors: [{
        toolId,
        name: 'governed_lookup',
        riskLevel: 'low',
        approvalRequired: false,
        inputSchema: toolFixture().inputSchema,
        metadata: { bindingId, descriptorIndex: 1, source: 'orchestra_mcp_catalog' },
        gatewayRef: { type: 'orchestra_tool_gateway', action: 'mcp.tool.execute' },
        ...overrides.descriptor,
      }],
    },
    observability: { usageEventEnabled: true, auditEnabled: true, qualityEvaluationEnabled: false },
    limits: { enforce: true, blockedBeforeRuntime: false },
  });
}

function toolRequest(overrides: Record<string, unknown> = {}) {
  return {
    runtimeTraceId: traceId,
    agentRunId: runId,
    assistantId,
    toolCallId: 'runtime-tool-call-1',
    toolId,
    arguments: { query: 'safe lookup' },
    sequence: 1,
    ...overrides,
  };
}

function postToolCall(body: string | object = toolRequest(), credential = gatewayKey) {
  return request(createApp())
    .post('/api/v1/runtime/agno/tool-calls')
    .set('Authorization', `Bearer ${credential}`)
    .send(body);
}

function activateGatewayRun(spec = specFixture()) {
  runtimeToolGatewayService.activateRun(spec, {
    provider: 'agno_http',
    assistantPublicationId: publicationId,
  });
}

describe('Agno governed tool gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureEnv();
    runtimeToolGatewayService.deactivateRun(runId);
    mocks.agentRunsRepository.findToolGatewayRun.mockResolvedValue(runFixture());
    mocks.agentRunsRepository.appendEvents.mockResolvedValue([]);
    mocks.mcpRepository.findAssistantForExecution.mockResolvedValue(assistantFixture());
    mocks.mcpRepository.getExecutionPolicy.mockResolvedValue(executionPolicy());
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture());
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture()]);
    mocks.mcpRepository.createMcpToolCallWithEvents.mockResolvedValue({ id: 'internal-call-id' });
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  afterAll(() => {
    runtimeToolGatewayService.deactivateRun(runId);
    configureEnv(originalEnv);
  });

  it('requires generic server-to-server authentication without leaking the configured key', async () => {
    const app = createApp();
    const missing = await request(app)
      .post('/api/v1/runtime/agno/tool-calls')
      .send(toolRequest())
      .expect(401);
    const invalid = await request(app)
      .post('/api/v1/runtime/agno/tool-calls')
      .set('Authorization', 'Bearer invalid-placeholder')
      .send(toolRequest())
      .expect(401);

    for (const response of [missing, invalid]) {
      expect(response.body).toEqual(expect.objectContaining({
        code: 'UNAUTHORIZED',
        message: 'Runtime authentication failed.',
      }));
      expect(JSON.stringify(response.body)).not.toContain(gatewayKey);
      expect(JSON.stringify(response.body)).not.toContain('invalid-placeholder');
    }
  });

  it('executes only a low-risk deterministic sandbox descriptor and returns a minimized result', async () => {
    activateGatewayRun();
    const response = await postToolCall().expect(200);

    expect(response.body.data).toEqual(expect.objectContaining({
      toolCallId: 'runtime-tool-call-1',
      status: 'succeeded',
      result: { content: 'Governed sandbox tool execution completed.' },
      metadata: expect.objectContaining({
        toolCallsExecuted: 1,
        externalMcpCalled: false,
        simulated: true,
        failedClosed: false,
      }),
    }));
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('safe lookup');
    expect(serialized).not.toMatch(/inputSchema|Authorization|Bearer|secret|serverUrl|baseUrl/i);

    const persisted = mocks.mcpRepository.createMcpToolCallWithEvents.mock.calls[0][0];
    expect(persisted.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted).not.toHaveProperty('inputPreview');
    expect(persisted).not.toHaveProperty('outputPreview');
    expect(JSON.stringify(persisted.agentRunEvents)).not.toContain('safe lookup');
    expect(JSON.stringify(persisted.agentRunEvents)).not.toMatch(/schema|header|secret|url/i);
    const audit = mocks.recordAuditEvent.mock.calls.at(-1)?.[0];
    expect(audit).toEqual(expect.objectContaining({
      action: 'runtime_tool_gateway_executed',
      metadata: expect.objectContaining({ toolCallsExecuted: 1, externalMcpCalled: false }),
    }));
    expect(JSON.stringify(audit)).not.toContain('safe lookup');
    expect(JSON.stringify(audit)).not.toMatch(/schema|header|secret|url/i);
  });

  it('is idempotent by toolCallId and rejects reuse with different arguments', async () => {
    activateGatewayRun();
    const first = await postToolCall().expect(200);
    const repeated = await postToolCall().expect(200);
    const conflict = await postToolCall(toolRequest({ arguments: { query: 'different safe lookup' } })).expect(200);

    expect(repeated.body.data).toEqual(first.body.data);
    expect(conflict.body.data).toEqual(expect.objectContaining({
      status: 'blocked',
      error: expect.objectContaining({ code: 'TOOL_CALL_IDEMPOTENCY_CONFLICT' }),
      metadata: expect.objectContaining({ reason: 'idempotency_conflict', failedClosed: true }),
    }));
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledTimes(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'runtime_tool_gateway_blocked',
      metadata: expect.objectContaining({ reason: 'idempotency_conflict' }),
    }));
  });

  it('fails closed for tools outside the active spec and when maxToolCalls is zero', async () => {
    activateGatewayRun(specFixture({ maxToolCalls: 0 }));
    const zeroLimit = await postToolCall().expect(200);
    expect(zeroLimit.body.data.metadata.reason).toBe('max_tool_calls_zero');

    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun();
    const outsideSpec = await postToolCall(toolRequest({
      toolId: '00000000-0000-0000-0000-000000000999',
      toolCallId: 'runtime-tool-call-outside',
    })).expect(200);
    expect(outsideSpec.body.data.metadata.reason).toBe('tool_not_in_spec');
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).not.toHaveBeenCalled();
  });

  it.each([
    ['medium risk', { riskLevel: 'medium' }, toolFixture({ riskLevel: 'medium' }), 'risk_not_low'],
    ['high risk', { riskLevel: 'high' }, toolFixture({ riskLevel: 'high' }), 'risk_not_low'],
    ['critical current risk', {}, toolFixture({ riskLevel: 'critical' }), 'risk_not_low'],
    ['approval required', { approvalRequired: true }, toolFixture({ requiresApproval: true }), 'approval_required'],
  ])('blocks %s descriptors and current policies', async (_label, descriptor, tool, reason) => {
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(tool);
    activateGatewayRun(specFixture({ descriptor }));
    const response = await postToolCall().expect(200);

    expect(response.body.data).toEqual(expect.objectContaining({
      status: 'blocked',
      metadata: expect.objectContaining({ reason, toolCallsExecuted: 0, externalMcpCalled: false }),
    }));
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).not.toHaveBeenCalled();
  });

  it('rejects invalid, sensitive, oversized, and unknown argument payloads without echoing them', async () => {
    activateGatewayRun();
    const invalidType = await postToolCall(toolRequest({ arguments: { query: 42 } })).expect(200);
    expect(invalidType.body.data.metadata.reason).toBe('invalid_arguments');

    const sensitive = await postToolCall(toolRequest({
      toolCallId: 'runtime-tool-call-sensitive',
      arguments: { query: 'Bearer synthetic-sensitive-value' },
    })).expect(422);
    expect(JSON.stringify(sensitive.body)).not.toContain('synthetic-sensitive-value');

    const unknown = await postToolCall({ ...toolRequest(), unexpected: true }).expect(422);
    expect(unknown.body.code).toBe('VALIDATION_ERROR');

    configureEnv({ AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES: 1024 });
    const oversized = await postToolCall(toolRequest({
      toolCallId: 'runtime-tool-call-oversized',
      arguments: { query: 'x'.repeat(1200) },
    })).expect(200);
    expect(oversized.body.data.metadata.reason).toBe('invalid_arguments');
    expect(JSON.stringify(oversized.body)).not.toContain('x'.repeat(1200));
  });

  it('serializes concurrent requests so maxToolCalls cannot be exceeded', async () => {
    activateGatewayRun(specFixture({ maxToolCalls: 1 }));
    const [first, second] = await Promise.all([
      postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-concurrent-1' })),
      postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-concurrent-2' })),
    ]);
    const statuses = [first.body.data.status, second.body.data.status].sort();

    expect(statuses).toEqual(['blocked', 'succeeded']);
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledTimes(1);
  });

  it('blocks an out-of-order sequence and a schema changed after the spec was built', async () => {
    activateGatewayRun(specFixture({ maxToolCalls: 2 }));
    const sequence = await postToolCall(toolRequest({ sequence: 2 })).expect(200);
    expect(sequence.body.data.metadata.reason).toBe('sequence_out_of_order');

    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun();
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      inputSchema: {
        type: 'object',
        properties: { term: { type: 'string' } },
        required: ['term'],
      },
    }));
    const schemaMismatch = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-schema' })).expect(200);
    expect(schemaMismatch.body.data.metadata.reason).toBe('tool_policy_blocked');
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).not.toHaveBeenCalled();

    const unsupportedSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        unused: { type: 'string', pattern: '^unsafe-to-evaluate$' },
      },
      required: ['query'],
    };
    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun(specFixture({ descriptor: { inputSchema: unsupportedSchema } }));
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({ inputSchema: unsupportedSchema }));
    const unsupported = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-unsupported-schema' })).expect(200);
    expect(unsupported.body.data.metadata.reason).toBe('invalid_arguments');
  });

  it('fails closed for trace, assistant, run status, and disabled gateway mismatches', async () => {
    activateGatewayRun();
    const traceMismatch = await postToolCall(toolRequest({ runtimeTraceId: 'trace_wrong' })).expect(200);
    expect(traceMismatch.body.data.metadata.reason).toBe('trace_mismatch');

    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun();
    const assistantMismatch = await postToolCall(toolRequest({
      assistantId: '00000000-0000-0000-0000-000000000999',
      toolCallId: 'runtime-tool-call-assistant',
    })).expect(200);
    expect(assistantMismatch.body.data.metadata.reason).toBe('assistant_mismatch');

    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun();
    mocks.agentRunsRepository.findToolGatewayRun.mockResolvedValueOnce(runFixture({
      assistantVersionId: '00000000-0000-0000-0000-000000000998',
    }));
    const versionMismatch = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-version' })).expect(200);
    expect(versionMismatch.body.data.metadata.reason).toBe('assistant_mismatch');

    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun();
    mocks.agentRunsRepository.findToolGatewayRun.mockResolvedValueOnce(runFixture({
      assistantPublicationId: '00000000-0000-0000-0000-000000000997',
    }));
    const publicationMismatch = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-publication' })).expect(200);
    expect(publicationMismatch.body.data.metadata.reason).toBe('assistant_mismatch');

    runtimeToolGatewayService.deactivateRun(runId);
    activateGatewayRun();
    mocks.agentRunsRepository.findToolGatewayRun.mockResolvedValueOnce(runFixture({ status: 'completed' }));
    const finalRun = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-final-run' })).expect(200);
    expect(finalRun.body.data.metadata.reason).toBe('run_not_executable');

    runtimeToolGatewayService.deactivateRun(runId);
    configureEnv({ AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: false });
    const disabled = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-disabled' })).expect(200);
    expect(disabled.body.data.metadata.reason).toBe('gateway_disabled');
  });

  it('fails closed when no active in-process run registry entry exists', async () => {
    const response = await postToolCall(toolRequest({ toolCallId: 'runtime-tool-call-inactive' })).expect(200);
    expect(response.body.data.metadata.reason).toBe('run_unavailable');
    expect(mocks.agentRunsRepository.findToolGatewayRun).not.toHaveBeenCalled();
  });
});
