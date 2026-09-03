import request from 'supertest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import {
  assistantRuntimeSpecV1Schema,
  createRuntimeToolGatewayService,
  runtimeToolGatewayService,
  type AssistantRuntimeSpecV1,
} from '../../src/modules/runtime';
import { McpRemoteClient } from '../../src/modules/mcp/remote/mcp-remote.client';
import { McpReadonlyDemoHttpTransport } from '../../src/modules/mcp/remote/mcp-readonly-demo-http.transport';

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
  mcpExecutionApprovalService: {
    validateClaimedForGateway: vi.fn(),
    consumeForGateway: vi.fn(),
    correlateConsumedToolCall: vi.fn(),
  },
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/agent-runs/agent-runs.repository', () => ({
  agentRunsRepository: mocks.agentRunsRepository,
}));

vi.mock('../../src/modules/mcp/mcp.repository', () => ({
  mcpRepository: mocks.mcpRepository,
}));

vi.mock('../../src/modules/mcp/mcp-execution-approval.service', () => ({
  mcpExecutionApprovalService: mocks.mcpExecutionApprovalService,
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
  MCP_REMOTE_ENABLED: env.MCP_REMOTE_ENABLED,
  MCP_REMOTE_EXECUTION_ENABLED: env.MCP_REMOTE_EXECUTION_ENABLED,
  MCP_REMOTE_DISCOVERY_ENABLED: env.MCP_REMOTE_DISCOVERY_ENABLED,
  MCP_REMOTE_READONLY_ENABLED: env.MCP_REMOTE_READONLY_ENABLED,
  MCP_REMOTE_EGRESS_ALLOWLIST: env.MCP_REMOTE_EGRESS_ALLOWLIST,
  MCP_REMOTE_ALLOW_WRITE_TOOLS: env.MCP_REMOTE_ALLOW_WRITE_TOOLS,
  MCP_REMOTE_REQUIRE_SECRET_REF: env.MCP_REMOTE_REQUIRE_SECRET_REF,
  MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: env.MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO,
  MCP_REMOTE_LOCAL_DEMO_ORIGIN: env.MCP_REMOTE_LOCAL_DEMO_ORIGIN,
};

function configureEnv(overrides: Partial<typeof originalEnv> = {}) {
  Object.assign(env, {
    ...originalEnv,
    AGNO_RUNTIME_HTTP_ENABLED: true,
    AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: true,
    AGNO_RUNTIME_HTTP_SECURITY_KEY: gatewayKey,
    AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: true,
    AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES: 32_768,
    MCP_REMOTE_ENABLED: false,
    MCP_REMOTE_EXECUTION_ENABLED: false,
    MCP_REMOTE_DISCOVERY_ENABLED: false,
    MCP_REMOTE_READONLY_ENABLED: false,
    MCP_REMOTE_EGRESS_ALLOWLIST: '',
    MCP_REMOTE_ALLOW_WRITE_TOOLS: false,
    MCP_REMOTE_REQUIRE_SECRET_REF: true,
    MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: false,
    MCP_REMOTE_LOCAL_DEMO_ORIGIN: undefined,
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
    mocks.mcpExecutionApprovalService.validateClaimedForGateway.mockResolvedValue(null);
    mocks.mcpExecutionApprovalService.consumeForGateway.mockResolvedValue(null);
    mocks.mcpExecutionApprovalService.correlateConsumedToolCall.mockResolvedValue({ count: 1 });
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

  it('executes a low-risk read-only remote tool only through an injected controlled client', async () => {
    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_DISCOVERY_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
      MCP_REMOTE_EGRESS_ALLOWLIST: 'https://mcp.example.test',
    });
    const remoteTool = toolFixture({
      name: 'search_records',
      description: 'Read matching records.',
      metadata: { readOnly: true },
      server: {
        id: serverId,
        serverType: 'remote',
        baseUrl: 'https://mcp.example.test/v1',
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        authType: 'none',
        secretRef: null,
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: false, allowRuntimeExecution: true, blockedByDefault: false }],
    });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(remoteTool);
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    const executeTool = vi.fn(async () => ({
      executionId: 'controlled-fake',
      status: 'completed' as const,
      content: '{"matches":2}',
      outputHash: 'safe-output-hash',
      durationMs: 4,
      externalMcpCalled: true,
      simulated: true,
      responseBytes: 13,
      remoteHost: 'mcp.example.test',
      events: [],
      sanitizedMetadata: {},
    }));
    const createRemoteClient = vi.fn(() => ({ executeTool }));
    const service = createRuntimeToolGatewayService({ createRemoteClient });
    service.activateRun(specFixture({ descriptor: { name: 'search_records' } }), {
      provider: 'agno_http',
      assistantPublicationId: publicationId,
    });

    const response = await service.execute(toolRequest(), { requestId: 'req_remote_controlled' });

    expect(response).toEqual(expect.objectContaining({
      status: 'succeeded',
      result: { content: '{"matches":2}' },
      metadata: expect.objectContaining({
        externalMcpCalled: true,
        simulated: true,
        mcpRemoteEvaluationApplied: true,
        mcpRemoteAllowed: true,
        mcpRemoteBlocked: false,
        mcpRemoteReadOnly: true,
        mcpRemoteHost: 'mcp.example.test',
        mcpRemoteToolId: toolId,
      }),
    }));
    expect(createRemoteClient).toHaveBeenCalledOnce();
    expect(executeTool).toHaveBeenCalledOnce();
    const persisted = mocks.mcpRepository.createMcpToolCallWithEvents.mock.calls[0][0];
    expect(persisted).toEqual(expect.objectContaining({
      mode: 'remote_controlled',
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadata: expect.objectContaining({ externalMcpCalled: true, mcpRemoteReadOnly: true }),
    }));
    expect(persisted).not.toHaveProperty('inputPreview');
    expect(persisted).not.toHaveProperty('outputPreview');
    expect(JSON.stringify(persisted)).not.toContain('safe lookup');
    expect(JSON.stringify(persisted)).not.toContain('{"matches":2}');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'runtime_tool_gateway_mcp_remote_readonly_executed',
      metadata: expect.objectContaining({ externalMcpCalled: true, mcpRemoteReadOnly: true }),
    }));
    service.deactivateRun(runId);
  });

  it('revalidates and consumes a claimed approval immediately before the remote call', async () => {
    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_DISCOVERY_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
      MCP_REMOTE_EGRESS_ALLOWLIST: 'https://mcp.example.test',
    });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      name: 'search_records',
      metadata: { readOnly: true },
      requiresApproval: true,
      server: {
        id: serverId,
        serverType: 'remote',
        baseUrl: 'https://mcp.example.test/v1',
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        authType: 'none',
        secretRef: null,
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: true, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([
      bindingFixture({ mode: 'enabled_placeholder', requiresApprovalOverride: true }),
    ]);
    mocks.mcpExecutionApprovalService.validateClaimedForGateway.mockResolvedValue({ id: 'approval-claimed' });
    mocks.mcpExecutionApprovalService.consumeForGateway.mockResolvedValue({ id: 'approval-consumed' });
    const executeTool = vi.fn(async () => ({
      executionId: 'controlled-approved',
      status: 'completed' as const,
      content: '{"matches":1}',
      outputHash: 'safe-output-hash',
      durationMs: 3,
      externalMcpCalled: true,
      simulated: true,
      responseBytes: 13,
      remoteHost: 'mcp.example.test',
      events: [],
      sanitizedMetadata: {},
    }));
    const service = createRuntimeToolGatewayService({ createRemoteClient: () => ({ executeTool }) });
    service.activateRun(specFixture({ descriptor: { name: 'search_records', approvalRequired: false } }), {
      provider: 'agno_http',
      assistantPublicationId: publicationId,
    });

    const response = await service.execute(toolRequest(), { requestId: 'req_approved_once' });

    expect(response.status).toBe('succeeded');
    expect(mocks.mcpExecutionApprovalService.validateClaimedForGateway).toHaveBeenCalledOnce();
    expect(mocks.mcpExecutionApprovalService.consumeForGateway).toHaveBeenCalledOnce();
    expect(mocks.mcpExecutionApprovalService.consumeForGateway.mock.invocationCallOrder[0])
      .toBeLessThan(executeTool.mock.invocationCallOrder[0]);
    expect(mocks.mcpExecutionApprovalService.correlateConsumedToolCall)
      .toHaveBeenCalledWith(runId, expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledWith(expect.objectContaining({
      approvalRequiredSnapshot: true,
      policySnapshot: expect.objectContaining({
        requiresApprovalByPolicy: true,
        approvalSatisfiedForRun: true,
      }),
    }));
    expect(JSON.stringify(service)).not.toContain('approval-claimed');
    service.deactivateRun(runId);
  });

  it('does not trust approvalRequired=false when no claimed server-side grant exists', async () => {
    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
    });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      metadata: { readOnly: true },
      requiresApproval: true,
      server: {
        id: serverId,
        serverType: 'remote',
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: true, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([
      bindingFixture({ mode: 'enabled_placeholder', requiresApprovalOverride: true }),
    ]);
    const createRemoteClient = vi.fn();
    const service = createRuntimeToolGatewayService({ createRemoteClient });
    service.activateRun(specFixture({ descriptor: { approvalRequired: false } }), {
      provider: 'agno_http',
      assistantPublicationId: publicationId,
    });

    const response = await service.execute(toolRequest(), { requestId: 'req_missing_grant' });

    expect(response).toEqual(expect.objectContaining({
      status: 'blocked',
      metadata: expect.objectContaining({
        externalMcpCalled: false,
        mcpRemoteBlockedReason: 'approval_required',
      }),
    }));
    expect(mocks.mcpExecutionApprovalService.consumeForGateway).not.toHaveBeenCalled();
    expect(createRemoteClient).not.toHaveBeenCalled();
    service.deactivateRun(runId);
  });

  it('blocks an expired claimed grant before consuming or calling remote MCP', async () => {
    configureEnv({ MCP_REMOTE_ENABLED: true, MCP_REMOTE_EXECUTION_ENABLED: true, MCP_REMOTE_READONLY_ENABLED: true });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      metadata: { readOnly: true },
      requiresApproval: true,
      server: { id: serverId, serverType: 'remote', status: 'active', trustLevel: 'trusted', riskLevel: 'low', deletedAt: null },
      policies: [{ sandboxOnly: false, requiresApproval: true, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    mocks.mcpExecutionApprovalService.validateClaimedForGateway.mockResolvedValue(null);
    const createRemoteClient = vi.fn();
    const service = createRuntimeToolGatewayService({ createRemoteClient });
    service.activateRun(specFixture(), { provider: 'agno_http', assistantPublicationId: publicationId });

    const response = await service.execute(toolRequest(), { requestId: 'req_expired_grant' });

    expect(response.status).toBe('blocked');
    expect(response.metadata.mcpRemoteBlockedReason).toBe('approval_required');
    expect(mocks.mcpExecutionApprovalService.consumeForGateway).not.toHaveBeenCalled();
    expect(createRemoteClient).not.toHaveBeenCalled();
    service.deactivateRun(runId);
  });

  it('blocks a second use of the one-shot grant', async () => {
    configureEnv({ MCP_REMOTE_ENABLED: true, MCP_REMOTE_EXECUTION_ENABLED: true, MCP_REMOTE_READONLY_ENABLED: true });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      metadata: { readOnly: true },
      requiresApproval: true,
      server: { id: serverId, serverType: 'remote', status: 'active', trustLevel: 'trusted', riskLevel: 'low', deletedAt: null },
      policies: [{ sandboxOnly: false, requiresApproval: true, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    mocks.mcpExecutionApprovalService.validateClaimedForGateway
      .mockResolvedValueOnce({ id: 'approval-claimed' })
      .mockResolvedValueOnce(null);
    mocks.mcpExecutionApprovalService.consumeForGateway.mockResolvedValueOnce({ id: 'approval-consumed' });
    const executeTool = vi.fn(async () => ({
      executionId: 'controlled-once', status: 'completed' as const, content: '{}', outputHash: 'hash', durationMs: 1,
      externalMcpCalled: true, simulated: true, events: [], sanitizedMetadata: {},
    }));
    const service = createRuntimeToolGatewayService({ createRemoteClient: () => ({ executeTool }) });
    service.activateRun(specFixture({ maxToolCalls: 2 }), { provider: 'agno_http', assistantPublicationId: publicationId });

    const first = await service.execute(toolRequest(), { requestId: 'req_once_1' });
    const second = await service.execute(toolRequest({ toolCallId: 'runtime-tool-call-2', sequence: 2 }), { requestId: 'req_once_2' });

    expect(first.status).toBe('succeeded');
    expect(second.status).toBe('blocked');
    expect(executeTool).toHaveBeenCalledOnce();
    expect(mocks.mcpExecutionApprovalService.consumeForGateway).toHaveBeenCalledOnce();
    service.deactivateRun(runId);
  });

  it('keeps the grant consumed when remote transport fails', async () => {
    configureEnv({ MCP_REMOTE_ENABLED: true, MCP_REMOTE_EXECUTION_ENABLED: true, MCP_REMOTE_READONLY_ENABLED: true });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      metadata: { readOnly: true },
      requiresApproval: true,
      server: { id: serverId, serverType: 'remote', status: 'active', trustLevel: 'trusted', riskLevel: 'low', deletedAt: null },
      policies: [{ sandboxOnly: false, requiresApproval: true, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    mocks.mcpExecutionApprovalService.validateClaimedForGateway.mockResolvedValue({ id: 'approval-claimed' });
    mocks.mcpExecutionApprovalService.consumeForGateway.mockResolvedValue({ id: 'approval-consumed', status: 'consumed' });
    const executeTool = vi.fn(async () => ({
      executionId: 'controlled-failed', status: 'failed' as const, durationMs: 1,
      externalMcpCalled: false, simulated: true, events: [], sanitizedMetadata: {},
    }));
    const service = createRuntimeToolGatewayService({ createRemoteClient: () => ({ executeTool }) });
    service.activateRun(specFixture(), { provider: 'agno_http', assistantPublicationId: publicationId });

    const response = await service.execute(toolRequest(), { requestId: 'req_transport_failed' });

    expect(response.status).toBe('blocked');
    expect(mocks.mcpExecutionApprovalService.consumeForGateway).toHaveBeenCalledOnce();
    expect(executeTool).toHaveBeenCalledOnce();
    expect(mocks.mcpExecutionApprovalService.correlateConsumedToolCall).not.toHaveBeenCalled();
    service.deactivateRun(runId);
  });

  it('passes a real local demo HTTP call through gateway governance with simulated=false', async () => {
    const demo = createServer(async (incoming, outgoing) => {
      if (incoming.method !== 'POST' || incoming.url !== '/v1/tools/call') {
        outgoing.writeHead(404, { 'content-type': 'application/json' });
        outgoing.end('{}');
        return;
      }
      for await (const _chunk of incoming) { /* consume without persisting or logging raw arguments */ }
      const body = JSON.stringify({ status: 'completed', content: '{"matches":[]}', simulated: false });
      outgoing.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      outgoing.end(body);
    });
    demo.listen(0, '127.0.0.1');
    await once(demo, 'listening');
    const address = demo.address();
    if (!address || typeof address === 'string') throw new Error('demo test server did not bind');
    const origin = `http://127.0.0.1:${address.port}`;

    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_DISCOVERY_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
      MCP_REMOTE_EGRESS_ALLOWLIST: origin,
      MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: true,
      MCP_REMOTE_LOCAL_DEMO_ORIGIN: origin,
    });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      name: 'catalog.search',
      description: 'Read matching fictitious catalog entries.',
      metadata: { readOnly: true },
      server: {
        id: serverId,
        serverType: 'remote',
        baseUrl: origin,
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        authType: 'none',
        secretRef: null,
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: false, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    const service = createRuntimeToolGatewayService({
      createRemoteClient: (options, config) => new McpRemoteClient(options, config, {
        transport: new McpReadonlyDemoHttpTransport({
          allowedOrigin: config.localDemoOrigin,
          maxResponseBytes: config.maxResponseBytes,
        }),
      }),
    });
    service.activateRun(specFixture({ descriptor: { name: 'catalog.search' } }), {
      provider: 'agno_http',
      assistantPublicationId: publicationId,
    });

    try {
      const response = await service.execute(toolRequest(), { requestId: 'req_remote_demo_real' });
      expect(response).toEqual(expect.objectContaining({
        status: 'succeeded',
        metadata: expect.objectContaining({
          externalMcpCalled: true,
          simulated: false,
          mcpRemoteAllowed: true,
          mcpRemoteReadOnly: true,
          mcpRemoteHost: '127.0.0.1',
        }),
      }));
      const persisted = mocks.mcpRepository.createMcpToolCallWithEvents.mock.calls[0][0];
      expect(persisted.metadata).toEqual(expect.objectContaining({ externalMcpCalled: true, simulated: false }));
      expect(persisted).not.toHaveProperty('inputPreview');
      expect(persisted).not.toHaveProperty('outputPreview');
      expect(JSON.stringify(persisted)).not.toContain('safe lookup');
      expect(JSON.stringify(persisted)).not.toContain('{"matches":[]}');
    } finally {
      service.deactivateRun(runId);
      demo.close();
      await once(demo, 'close');
    }
  });

  it('blocks a remote tool without an explicit read-only marker before creating a client', async () => {
    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_DISCOVERY_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
      MCP_REMOTE_EGRESS_ALLOWLIST: 'https://mcp.example.test',
    });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      metadata: {},
      server: {
        id: serverId,
        serverType: 'remote',
        baseUrl: 'https://mcp.example.test',
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        authType: 'none',
        secretRef: null,
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: false, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    const createRemoteClient = vi.fn();
    const service = createRuntimeToolGatewayService({ createRemoteClient });
    service.activateRun(specFixture(), { provider: 'agno_http', assistantPublicationId: publicationId });

    const response = await service.execute(toolRequest(), { requestId: 'req_remote_blocked' });

    expect(response).toEqual(expect.objectContaining({
      status: 'blocked',
      metadata: expect.objectContaining({
        reason: 'mcp_remote_policy_blocked',
        externalMcpCalled: false,
        mcpRemoteEvaluationApplied: true,
        mcpRemoteAllowed: false,
        mcpRemoteBlocked: true,
        mcpRemoteBlockedReason: 'tool_not_readonly',
      }),
    }));
    expect(createRemoteClient).not.toHaveBeenCalled();
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).not.toHaveBeenCalled();
    service.deactivateRun(runId);
  });

  it('blocks a remote write-capable tool before creating a client', async () => {
    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_DISCOVERY_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
      MCP_REMOTE_EGRESS_ALLOWLIST: 'https://mcp.example.test',
    });
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      name: 'catalog.delete',
      description: 'Synthetic write-shaped fixture that must never execute.',
      metadata: { readOnly: true, operation: 'delete' },
      server: {
        id: serverId,
        serverType: 'remote',
        baseUrl: 'https://mcp.example.test',
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        authType: 'none',
        secretRef: null,
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: false, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    const createRemoteClient = vi.fn();
    const service = createRuntimeToolGatewayService({ createRemoteClient });
    service.activateRun(specFixture({ descriptor: { name: 'catalog.delete' } }), {
      provider: 'agno_http',
      assistantPublicationId: publicationId,
    });

    const response = await service.execute(toolRequest(), { requestId: 'req_remote_write_blocked' });

    expect(response).toEqual(expect.objectContaining({
      status: 'blocked',
      metadata: expect.objectContaining({
        externalMcpCalled: false,
        mcpRemoteBlocked: true,
        mcpRemoteBlockedReason: 'dangerous_operation',
      }),
    }));
    expect(createRemoteClient).not.toHaveBeenCalled();
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toMatch(/Synthetic write-shaped|catalog\.delete/i);
    service.deactivateRun(runId);
  });

  it('keeps remote tools blocked in sandbox runs before creating a client', async () => {
    configureEnv({
      MCP_REMOTE_ENABLED: true,
      MCP_REMOTE_EXECUTION_ENABLED: true,
      MCP_REMOTE_DISCOVERY_ENABLED: true,
      MCP_REMOTE_READONLY_ENABLED: true,
      MCP_REMOTE_EGRESS_ALLOWLIST: 'https://mcp.example.test',
    });
    mocks.agentRunsRepository.findToolGatewayRun.mockResolvedValue(runFixture({
      mode: 'sandbox',
      assistantPublicationId: null,
    }));
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(toolFixture({
      name: 'search_records',
      description: 'Read matching records.',
      metadata: { readOnly: true },
      server: {
        id: serverId,
        serverType: 'remote',
        baseUrl: 'https://mcp.example.test/v1',
        status: 'active',
        trustLevel: 'trusted',
        riskLevel: 'low',
        authType: 'none',
        secretRef: null,
        deletedAt: null,
      },
      policies: [{ sandboxOnly: false, requiresApproval: false, allowRuntimeExecution: true, blockedByDefault: false }],
    }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([bindingFixture({ mode: 'enabled_placeholder' })]);
    const createRemoteClient = vi.fn();
    const service = createRuntimeToolGatewayService({ createRemoteClient });
    service.activateRun(specFixture({ descriptor: { name: 'search_records' } }), {
      provider: 'agno_http',
      assistantPublicationId: null,
    });

    const response = await service.execute(toolRequest(), { requestId: 'req_remote_sandbox_blocked' });

    expect(response).toEqual(expect.objectContaining({
      status: 'blocked',
      metadata: expect.objectContaining({
        externalMcpCalled: false,
        mcpRemoteBlocked: true,
        mcpRemoteBlockedReason: 'sandbox_only',
      }),
    }));
    expect(createRemoteClient).not.toHaveBeenCalled();
    service.deactivateRun(runId);
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
