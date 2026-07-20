import { describe, expect, it, vi } from 'vitest';
import { validateMcpRemoteEgress } from '../../src/modules/mcp/remote/mcp-remote-egress';
import { McpRemoteClient } from '../../src/modules/mcp/remote/mcp-remote.client';
import type { McpRemoteClientTransport } from '../../src/modules/mcp/remote/mcp-remote-transport';
import type {
  GovernedMcpToolExecutionSpec,
  McpRemoteFeatureConfig,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const publicResolver = async () => ['93.184.216.34'];

const enabledConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: true,
  executionEnabled: true,
  readOnlyEnabled: true,
  egressAllowlist: 'https://mcp.example.test',
  defaultTimeoutMs: 1000,
  maxTimeoutMs: 2000,
  maxResponseBytes: 4096,
  requireSecretRef: true,
  allowWriteTools: false,
};

function executionSpec(overrides: Partial<GovernedMcpToolExecutionSpec['tool']> = {}): GovernedMcpToolExecutionSpec {
  return {
    executionId: 'exec_readonly_test',
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    assistantId: '00000000-0000-0000-0000-000000000601',
    mcpServerId: '00000000-0000-0000-0000-000000000701',
    mcpToolId: '00000000-0000-0000-0000-000000000801',
    assistantMcpBindingId: '00000000-0000-0000-0000-000000000901',
    requestedByUserId: '00000000-0000-0000-0000-000000000030',
    mode: 'remote_controlled',
    requestId: 'req_readonly_test',
    traceId: 'trace_readonly_test',
    tool: {
      externalName: 'search_records',
      displayName: 'Search records',
      description: 'Read records matching a query.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      riskLevel: 'low',
      requiresApproval: false,
      readOnly: true,
      ...overrides,
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
      timeoutMs: 1000,
      maxInputBytes: 4096,
      maxOutputBytes: 4096,
    },
    input: {
      hash: 'safe_input_hash',
      value: { query: 'safe query' },
    },
  };
}

function fakeTransport(content = '{"matches":2}', responseBytes = Buffer.byteLength(content)): McpRemoteClientTransport {
  return {
    checkHealth: vi.fn(async () => ({ status: 'healthy' as const, simulated: true })),
    discoverTools: vi.fn(async () => ({ serverId: 'server', status: 'completed' as const, discoveredAt: new Date(0).toISOString(), tools: [], diff: { added: [], changed: [], removed: [] }, warnings: [] })),
    executeReadonlyTool: vi.fn(async () => ({ content, responseBytes, simulated: true })),
  };
}

describe('MCP remote egress boundary', () => {
  it('allows only an explicit HTTPS origin resolving to public addresses', async () => {
    await expect(validateMcpRemoteEgress(
      'https://mcp.example.test/v1/tools',
      'https://mcp.example.test',
      publicResolver,
    )).resolves.toMatchObject({
      host: 'mcp.example.test',
      port: 443,
      origin: 'https://mcp.example.test:443',
    });
  });

  it.each([
    ['plain HTTP', 'http://mcp.example.test', 'http://mcp.example.test'],
    ['embedded credentials', 'https://user:password@mcp.example.test', 'https://mcp.example.test'],
    ['credential-shaped query', 'https://mcp.example.test?token=raw-token-fixture', 'https://mcp.example.test'],
    ['localhost', 'https://localhost', 'https://localhost'],
    ['IPv4 loopback', 'https://127.0.0.1', 'https://127.0.0.1'],
    ['IPv4 unspecified', 'https://0.0.0.0', 'https://0.0.0.0'],
    ['IPv6 loopback', 'https://[::1]', 'https://[::1]'],
    ['link-local IPv4', 'https://169.254.169.254', 'https://169.254.169.254'],
    ['private IPv4 172/12', 'https://172.16.0.8', 'https://172.16.0.8'],
    ['private IPv4 192/16', 'https://192.168.0.8', 'https://192.168.0.8'],
    ['cloud metadata', 'https://metadata.google.internal', 'https://metadata.google.internal'],
    ['private IPv4', 'https://10.0.0.8', 'https://10.0.0.8'],
    ['non-allowlisted origin', 'https://other.example.test', 'https://mcp.example.test'],
  ])('blocks %s before transport', async (_label, target, allowlist) => {
    await expect(validateMcpRemoteEgress(target, allowlist, publicResolver)).rejects.toMatchObject({
      code: 'MCP_REMOTE_EGRESS_BLOCKED',
    });
  });

  it('blocks a read-only tool while the dedicated read-only flag is disabled', async () => {
    const transport = fakeTransport();
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'none',
      timeoutMs: 1000,
    }, { ...enabledConfig, readOnlyEnabled: false }, { transport, resolveHost: publicResolver });

    await expect(client.executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_READONLY_DISABLED',
    });
    expect(transport.executeReadonlyTool).not.toHaveBeenCalled();
  });

  it('blocks DNS rebinding/private resolution results', async () => {
    await expect(validateMcpRemoteEgress(
      'https://mcp.example.test',
      'https://mcp.example.test',
      async () => ['169.254.169.254'],
    )).rejects.toMatchObject({ code: 'MCP_REMOTE_EGRESS_BLOCKED' });
  });
});

describe('MCP remote read-only client', () => {
  it('sanitizes arbitrary health and discovery transport failures', async () => {
    const transport = fakeTransport();
    vi.mocked(transport.checkHealth).mockRejectedValueOnce(new Error('Bearer must-not-leak-health'));
    vi.mocked(transport.discoverTools).mockRejectedValueOnce(new Error('apiKey=must-not-leak-discovery'));
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'none',
      timeoutMs: 1000,
    }, enabledConfig, { transport, resolveHost: publicResolver });

    await expect(client.checkHealth()).rejects.toMatchObject({
      code: 'MCP_REMOTE_TRANSPORT_FAILED',
      message: 'MCP remote transport failed.',
    });
    await expect(client.discoverTools({
      tenantId: '00000000-0000-0000-0000-000000000010',
      workspaceId: '00000000-0000-0000-0000-000000000020',
      serverId: 'server',
      requestedByUserId: '00000000-0000-0000-0000-000000000030',
      requestId: 'req_discovery_failure',
      mode: 'dry_run',
      timeoutMs: 1000,
    })).rejects.toMatchObject({
      code: 'MCP_REMOTE_TRANSPORT_FAILED',
      message: 'MCP remote transport failed.',
    });
  });

  it('executes an explicitly read-only low-risk tool through the injected fake transport', async () => {
    const transport = fakeTransport();
    const client = new McpRemoteClient({
      serverId: '00000000-0000-0000-0000-000000000701',
      baseUrl: 'https://mcp.example.test/v1',
      authType: 'none',
      timeoutMs: 1000,
    }, enabledConfig, { transport, resolveHost: publicResolver });

    const result = await client.executeTool(executionSpec());

    expect(result).toMatchObject({
      status: 'completed',
      content: '{"matches":2}',
      externalMcpCalled: true,
      simulated: true,
      remoteHost: 'mcp.example.test',
      sanitizedMetadata: {
        mcpRemoteEvaluationApplied: true,
        mcpRemoteAllowed: true,
        mcpRemoteReadOnly: true,
      },
    });
    expect(transport.executeReadonlyTool).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain('safe query');
  });

  it.each([
    ['tool is not read-only', { readOnly: false }, 'MCP_REMOTE_TOOL_NOT_READONLY'],
    ['tool name is write-capable', { externalName: 'delete_records' }, 'MCP_REMOTE_TOOL_OPERATION_BLOCKED'],
    ['tool metadata is write-capable', { metadata: { action: 'delete' } }, 'MCP_REMOTE_TOOL_OPERATION_BLOCKED'],
    ['tool risk is not low', { riskLevel: 'medium' as const }, 'MCP_REMOTE_POLICY_BLOCKED'],
  ])('blocks when %s without invoking transport', async (_label, tool, code) => {
    const transport = fakeTransport();
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'none',
      timeoutMs: 1000,
    }, enabledConfig, { transport, resolveHost: publicResolver });

    await expect(client.executeTool(executionSpec(tool))).rejects.toMatchObject({ code });
    expect(transport.executeReadonlyTool).not.toHaveBeenCalled();
  });

  it('requires a logical secret reference for credentialed auth', async () => {
    const transport = fakeTransport();
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'bearer',
      credentialsConfigured: true,
      timeoutMs: 1000,
    }, enabledConfig, { transport, resolveHost: publicResolver });

    await expect(client.executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_SECRET_REF_REQUIRED',
    });
    expect(transport.executeReadonlyTool).not.toHaveBeenCalled();
  });

  it('rejects oversized fake responses after the governed call', async () => {
    const transport = fakeTransport('small', 8192);
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'none',
      timeoutMs: 1000,
    }, enabledConfig, { transport, resolveHost: publicResolver });

    await expect(client.executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_RESPONSE_TOO_LARGE',
    });
  });

  it('aborts a controlled fake transport when the governed timeout is reached', async () => {
    const transport = fakeTransport();
    vi.mocked(transport.executeReadonlyTool).mockImplementationOnce(async () => new Promise(() => undefined));
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'none',
      timeoutMs: 100,
    }, { ...enabledConfig, maxTimeoutMs: 100 }, { transport, resolveHost: publicResolver });

    await expect(client.executeTool({
      ...executionSpec(),
      limits: { ...executionSpec().limits, timeoutMs: 100 },
    })).rejects.toMatchObject({ code: 'MCP_REMOTE_TIMEOUT' });
  });
});
