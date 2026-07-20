import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  GovernedMcpRemotePolicy,
  GovernedMcpRemoteServer,
  McpRemoteDiscoveryInput,
  McpRemoteFeatureConfig,
} from '../../src/modules/mcp/remote/mcp-remote.types';
import type { McpRemoteDiscoveryTransport } from '../../src/modules/mcp/remote/mcp-remote-transport';

const originalEnv = { ...process.env };

const safetyConfig = {
  readOnlyEnabled: false,
  egressAllowlist: 'https://mcp.example.invalid',
  maxTimeoutMs: 5000,
  maxResponseBytes: 65_536,
  requireSecretRef: true,
  allowWriteTools: false,
} as const;

const resolvePublicHost = async () => ['93.184.216.34'];

const failClosedConfig: McpRemoteFeatureConfig = {
  remoteEnabled: false,
  discoveryEnabled: false,
  executionEnabled: false,
  defaultTimeoutMs: 5000,
  ...safetyConfig,
};

const discoveryEnabledExecutionBlockedConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: true,
  executionEnabled: false,
  defaultTimeoutMs: 1234,
  ...safetyConfig,
};

const discoveryDisabledConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: false,
  executionEnabled: false,
  defaultTimeoutMs: 5000,
  ...safetyConfig,
};

function server(overrides: Partial<GovernedMcpRemoteServer> = {}): GovernedMcpRemoteServer {
  return {
    id: '00000000-0000-0000-0000-000000000701',
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    name: 'Governed Remote MCP',
    status: 'active',
    baseUrl: 'https://mcp.example.invalid',
    authType: 'none',
    trustLevel: 'restricted',
    riskLevel: 'medium',
    ...overrides,
  };
}

function remotePolicy(overrides: Partial<GovernedMcpRemotePolicy> = {}): GovernedMcpRemotePolicy {
  return {
    allowDiscovery: true,
    allowRuntimeExecution: false,
    sandboxOnly: true,
    blockedByDefault: true,
    requiresApproval: true,
    ...overrides,
  };
}

function discoveryInput(overrides: Partial<McpRemoteDiscoveryInput> = {}): McpRemoteDiscoveryInput {
  return {
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    server: server(),
    policy: remotePolicy(),
    credentialsConfigured: false,
    requestedByUserId: '00000000-0000-0000-0000-000000000030',
    requestId: 'req_test_discovery',
    ...overrides,
  };
}

async function loadRemote() {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: originalEnv.DATABASE_URL ?? 'postgresql://orchestra:orchestra@localhost:5432/orchestra',
    JWT_SECRET: 'test-secret',
    MCP_REMOTE_ENABLED: undefined,
    MCP_REMOTE_EXECUTION_ENABLED: undefined,
    MCP_REMOTE_DISCOVERY_ENABLED: undefined,
    MCP_REMOTE_READONLY_ENABLED: undefined,
    MCP_REMOTE_EGRESS_ALLOWLIST: undefined,
    MCP_REMOTE_MAX_TIMEOUT_MS: undefined,
    MCP_REMOTE_MAX_RESPONSE_BYTES: undefined,
    MCP_REMOTE_REQUIRE_SECRET_REF: undefined,
    MCP_REMOTE_ALLOW_WRITE_TOOLS: undefined,
    MCP_REMOTE_DEFAULT_TIMEOUT_MS: undefined,
  };
  return import('../../src/modules/mcp/remote/mcp-remote-discovery.service');
}

describe('MCP remote governed discovery', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('blocks discovery before transport when MCP remote is disabled', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const transport: McpRemoteDiscoveryTransport = {
      discoverTools: vi.fn(),
    };
    const service = new McpRemoteDiscoveryService({ transport, config: failClosedConfig, resolveHost: resolvePublicHost });

    const result = await service.runGovernedDiscovery(discoveryInput());

    expect(result.status).toBe('blocked');
    expect(result.readiness.status).toBe('disabled');
    expect(result.sanitizedMetadata).toMatchObject({ transportCalled: false, executionBlocked: true });
    expect(transport.discoverTools).not.toHaveBeenCalled();
  });

  it('blocks discovery before transport when the discovery flag is disabled', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const transport: McpRemoteDiscoveryTransport = {
      discoverTools: vi.fn(),
    };
    const service = new McpRemoteDiscoveryService({ transport, config: discoveryDisabledConfig, resolveHost: resolvePublicHost });

    const result = await service.discoverRemoteTools(discoveryInput());

    expect(result.status).toBe('blocked');
    expect(result.readiness.status).toBe('discovery_disabled');
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'MCP_REMOTE_DISCOVERY_BLOCKED' }));
    expect(transport.discoverTools).not.toHaveBeenCalled();
  });

  it('blocks discovery before transport when readiness is not ready', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const transport: McpRemoteDiscoveryTransport = {
      discoverTools: vi.fn(),
    };
    const service = new McpRemoteDiscoveryService({ transport, config: discoveryEnabledExecutionBlockedConfig, resolveHost: resolvePublicHost });

    const result = await service.runGovernedDiscovery(discoveryInput({
      server: server({ baseUrl: null }),
    }));

    expect(result.status).toBe('blocked');
    expect(result.readiness.status).toBe('misconfigured');
    expect(transport.discoverTools).not.toHaveBeenCalled();
  });

  it('allows governed discovery while execution remains disabled and normalizes returned tools', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const executeTool = vi.fn();
    const transport = {
      discoverTools: vi.fn(async () => ({
        protocolVersion: '2026-06-26',
        tools: [
          {
            externalName: 'search_all_records',
            displayName: 'Search All Records',
            description: 'Search all workspace records for a query.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                password: { type: 'string', default: 'raw-secret-fixture' },
              },
            },
            outputSchema: {
              type: 'object',
              properties: {
                rows: { type: 'array' },
              },
            },
          },
        ],
      })),
      executeTool,
    };
    const service = new McpRemoteDiscoveryService({
      transport,
      config: discoveryEnabledExecutionBlockedConfig,
      resolveHost: resolvePublicHost,
    });

    const result = await service.runGovernedDiscovery(discoveryInput());

    expect(result.status).toBe('completed');
    expect(result.readiness.status).toBe('ready');
    expect(result.readiness.executionEnabled).toBe(false);
    expect(result.readiness.checks).toContainEqual(expect.objectContaining({ name: 'execution', status: 'skipped' }));
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toMatchObject({
      externalName: 'search_all_records',
      inferredRiskLevel: 'medium',
      requiresApproval: true,
      defaultPolicy: {
        allowRuntimeExecution: false,
        sandboxOnly: true,
        blockedByDefault: true,
      },
    });
    expect(result.tools[0].specHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.specHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('raw-secret-fixture');
    expect(JSON.stringify(result)).not.toContain('password');
    expect(transport.discoverTools).toHaveBeenCalledWith(expect.objectContaining({
      serverId: '00000000-0000-0000-0000-000000000701',
      baseUrl: 'https://mcp.example.invalid',
      authType: 'none',
      credentialsConfigured: false,
      timeoutMs: 1234,
      requestId: 'req_test_discovery',
    }));
    expect(executeTool).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps discovered tools blocked by default for high and critical risks', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const transport: McpRemoteDiscoveryTransport = {
      discoverTools: vi.fn(async () => ({
        tools: [
          { externalName: 'create_invoice', description: 'Create invoice drafts.' },
          { externalName: 'delete_admin_permission', description: 'Delete admin permission records.' },
        ],
      })),
    };
    const service = new McpRemoteDiscoveryService({ transport, config: discoveryEnabledExecutionBlockedConfig, resolveHost: resolvePublicHost });

    const result = await service.runGovernedDiscovery(discoveryInput());

    expect(result.tools.map((tool) => tool.inferredRiskLevel)).toEqual(['high', 'critical']);
    expect(result.tools.every((tool) => tool.requiresApproval)).toBe(true);
    expect(result.tools.every((tool) => tool.defaultPolicy.allowRuntimeExecution === false)).toBe(true);
    expect(result.tools.every((tool) => tool.defaultPolicy.sandboxOnly === true)).toBe(true);
    expect(result.tools.every((tool) => tool.defaultPolicy.blockedByDefault === true)).toBe(true);
  });

  it('identifies added, changed and removed tools by externalName and specHash', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const transport: McpRemoteDiscoveryTransport = {
      discoverTools: vi.fn(async () => ({
        tools: [
          { externalName: 'search_all_records', description: 'Search all workspace records.' },
          { externalName: 'create_invoice', description: 'Create invoice drafts.' },
        ],
      })),
    };
    const service = new McpRemoteDiscoveryService({ transport, config: discoveryEnabledExecutionBlockedConfig, resolveHost: resolvePublicHost });

    const result = await service.runGovernedDiscovery(discoveryInput({
      existingTools: [
        { externalName: 'search_all_records', specHash: 'old_hash' },
        { externalName: 'removed_tool', specHash: 'removed_hash' },
      ],
    }));

    expect(result.diff).toEqual({
      added: ['create_invoice'],
      changed: ['search_all_records'],
      removed: ['removed_tool'],
    });
  });

  it('blocks controlled discovery when policy explicitly denies it', async () => {
    const { McpRemoteDiscoveryService } = await loadRemote();
    const transport: McpRemoteDiscoveryTransport = {
      discoverTools: vi.fn(),
    };
    const service = new McpRemoteDiscoveryService({ transport, config: discoveryEnabledExecutionBlockedConfig, resolveHost: resolvePublicHost });

    const result = await service.runGovernedDiscovery(discoveryInput({
      policy: remotePolicy({ allowDiscovery: false }),
    }));

    expect(result.status).toBe('blocked');
    expect(result.readiness.status).toBe('blocked');
    expect(transport.discoverTools).not.toHaveBeenCalled();
  });
});
