import { createServer } from 'node:http';
import { once } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { validateMcpRemoteEgress } from '../../src/modules/mcp/remote/mcp-remote-egress';
import { McpRemoteClient } from '../../src/modules/mcp/remote/mcp-remote.client';
import { McpReadonlyDemoHttpTransport } from '../../src/modules/mcp/remote/mcp-readonly-demo-http.transport';
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

  it('allows the exact HTTP demo origin only with explicit non-production exception and allowlist', async () => {
    const policy = {
      environment: 'test' as const,
      allowInsecureLocalDemo: true,
      localDemoOrigin: 'http://127.0.0.1:8092',
    };
    await expect(validateMcpRemoteEgress(
      'http://127.0.0.1:8092',
      'http://127.0.0.1:8092',
      async () => ['127.0.0.1'],
      policy,
    )).resolves.toMatchObject({ protocol: 'http:', host: '127.0.0.1', port: 8092 });

    await expect(validateMcpRemoteEgress(
      'http://127.0.0.1:8092',
      '',
      async () => ['127.0.0.1'],
      policy,
    )).rejects.toMatchObject({ code: 'MCP_REMOTE_EGRESS_BLOCKED' });
  });

  it('forbids the insecure demo exception in production and for non-demo private hosts', async () => {
    await expect(validateMcpRemoteEgress(
      'http://127.0.0.1:8092',
      'http://127.0.0.1:8092',
      async () => ['127.0.0.1'],
      {
        environment: 'production',
        allowInsecureLocalDemo: true,
        localDemoOrigin: 'http://127.0.0.1:8092',
      },
    )).rejects.toMatchObject({ code: 'MCP_REMOTE_EGRESS_BLOCKED' });

    await expect(validateMcpRemoteEgress(
      'http://10.0.0.8:8092',
      'http://10.0.0.8:8092',
      async () => ['10.0.0.8'],
      {
        environment: 'test',
        allowInsecureLocalDemo: true,
        localDemoOrigin: 'http://10.0.0.8:8092',
      },
    )).rejects.toMatchObject({ code: 'MCP_REMOTE_EGRESS_BLOCKED' });
  });
});

describe('MCP remote read-only client', () => {
  it('executes the controlled demo over real local HTTP with simulated=false', async () => {
    const server = createServer(async (request, response) => {
      const send = (payload: unknown) => {
        const body = JSON.stringify(payload);
        response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
        response.end(body);
      };
      if (request.method === 'GET' && request.url === '/health') {
        send({ status: 'healthy', service: 'mcp-readonly-demo' });
        return;
      }
      if (request.method === 'GET' && request.url === '/v1/catalog') {
        send({
          status: 'ready',
          protocolVersion: 'orchestra-mcp-http-readonly/1.0',
          server: { readOnly: true, dataClassification: 'fictitious' },
          tools: [
            {
              externalName: 'catalog.search',
              displayName: 'Catalog Search',
              description: 'Read matching fictitious catalog entries.',
              readOnly: true,
              riskLevel: 'low',
              inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
              outputSchema: { type: 'object', properties: { matches: { type: 'array' } } },
            },
            {
              externalName: 'catalog.get_status',
              displayName: 'Catalog Get Status',
              description: 'Read one fictitious status.',
              readOnly: true,
              riskLevel: 'low',
              inputSchema: { type: 'object', properties: { itemId: { type: 'string' } } },
              outputSchema: { type: 'object', properties: { found: { type: 'boolean' } } },
            },
          ],
        });
        return;
      }
      if (request.method === 'POST' && request.url === '/v1/tools/call') {
        for await (const _chunk of request) { /* consume the governed request without logging it */ }
        send({ status: 'completed', content: '{"matches":[]}', simulated: false });
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{}');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not bind');
    const origin = `http://127.0.0.1:${address.port}`;
    const config: McpRemoteFeatureConfig = {
      ...enabledConfig,
      environment: 'test',
      allowInsecureLocalDemo: true,
      localDemoOrigin: origin,
      egressAllowlist: origin,
    };
    const transport = new McpReadonlyDemoHttpTransport({ allowedOrigin: origin, maxResponseBytes: 4096 });
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: origin,
      authType: 'none',
      timeoutMs: 1000,
    }, config, { transport });

    try {
      const health = await client.checkHealth();
      const discovery = await client.discoverTools({
        tenantId: '00000000-0000-0000-0000-000000000010',
        workspaceId: '00000000-0000-0000-0000-000000000020',
        serverId: 'server',
        requestedByUserId: '00000000-0000-0000-0000-000000000030',
        requestId: 'req-real-demo',
        mode: 'dry_run',
        timeoutMs: 1000,
      });
      const result = await client.executeTool(executionSpec({
        externalName: 'catalog.search',
        displayName: 'Catalog Search',
        description: 'Read matching fictitious catalog entries.',
      }));
      expect(health).toMatchObject({ transportChecked: true, transportHealthy: true, simulated: false });
      expect(discovery.tools.map((tool) => tool.externalName)).toEqual(['catalog.search', 'catalog.get_status']);
      expect(JSON.stringify(discovery)).not.toMatch(/secretRef|authorization|cookie/i);
      expect(result).toMatchObject({
        status: 'completed',
        externalMcpCalled: true,
        simulated: false,
        remoteHost: '127.0.0.1',
      });
      expect(JSON.stringify(result)).not.toContain('safe query');
    } finally {
      server.close();
      await once(server, 'close');
    }
  });

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

  it('rejects oversized input before invoking any transport', async () => {
    const transport = fakeTransport();
    const client = new McpRemoteClient({
      serverId: 'server',
      baseUrl: 'https://mcp.example.test',
      authType: 'none',
      timeoutMs: 1000,
    }, enabledConfig, { transport, resolveHost: publicResolver });

    await expect(client.executeTool({
      ...executionSpec(),
      limits: { ...executionSpec().limits, maxInputBytes: 8 },
    })).rejects.toMatchObject({ code: 'MCP_REMOTE_POLICY_BLOCKED' });
    expect(transport.executeReadonlyTool).not.toHaveBeenCalled();
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
