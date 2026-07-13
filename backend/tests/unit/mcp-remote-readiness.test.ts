import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  GovernedMcpRemotePolicy,
  GovernedMcpRemoteServer,
  GovernedMcpToolExecutionSpec,
  McpRemoteClientOptions,
  McpRemoteFeatureConfig,
  McpToolDiscoveryRequest,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const originalEnv = { ...process.env };

const failClosedConfig: McpRemoteFeatureConfig = {
  remoteEnabled: false,
  discoveryEnabled: false,
  executionEnabled: false,
  defaultTimeoutMs: 5000,
};

const enabledConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: true,
  executionEnabled: true,
  defaultTimeoutMs: 5000,
};

const executionDisabledConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: true,
  executionEnabled: false,
  defaultTimeoutMs: 5000,
};

const discoveryDisabledConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: false,
  executionEnabled: true,
  defaultTimeoutMs: 5000,
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
    allowRuntimeExecution: true,
    sandboxOnly: false,
    blockedByDefault: false,
    requiresApproval: false,
    ...overrides,
  };
}

function clientOptions(overrides: Partial<McpRemoteClientOptions> = {}): McpRemoteClientOptions {
  return {
    serverId: '00000000-0000-0000-0000-000000000701',
    baseUrl: 'https://mcp.example.invalid',
    authType: 'none',
    credentialsConfigured: false,
    timeoutMs: 5000,
    ...overrides,
  };
}

function discoveryRequest(): McpToolDiscoveryRequest {
  return {
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    serverId: '00000000-0000-0000-0000-000000000701',
    requestedByUserId: '00000000-0000-0000-0000-000000000030',
    requestId: 'req_test',
    mode: 'dry_run',
    timeoutMs: 5000,
  };
}

function executionSpec(): GovernedMcpToolExecutionSpec {
  return {
    executionId: 'exec_test',
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    assistantId: '00000000-0000-0000-0000-000000000601',
    mcpServerId: '00000000-0000-0000-0000-000000000701',
    mcpToolId: '00000000-0000-0000-0000-000000000801',
    assistantMcpBindingId: '00000000-0000-0000-0000-000000000901',
    requestedByUserId: '00000000-0000-0000-0000-000000000030',
    mode: 'remote_controlled',
    requestId: 'req_test',
    traceId: 'trace_test',
    tool: {
      externalName: 'search_records',
      displayName: 'Search Records',
      riskLevel: 'low',
      requiresApproval: false,
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
      timeoutMs: 5000,
      maxInputBytes: 8000,
      maxOutputBytes: 16000,
    },
    input: {
      hash: 'input_hash',
      preview: 'safe preview',
      value: { query: 'records' },
    },
  };
}

async function loadRemote(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: originalEnv.DATABASE_URL ?? 'postgresql://orchestra:orchestra@localhost:5432/orchestra',
    JWT_SECRET: 'test-secret',
    MCP_REMOTE_ENABLED: undefined,
    MCP_REMOTE_EXECUTION_ENABLED: undefined,
    MCP_REMOTE_DISCOVERY_ENABLED: undefined,
    MCP_REMOTE_DEFAULT_TIMEOUT_MS: undefined,
    ...overrides,
  };
  const [configModule, readinessModule, clientModule] = await Promise.all([
    import('../../src/modules/mcp/remote/mcp-remote.config'),
    import('../../src/modules/mcp/remote/mcp-remote-readiness.service'),
    import('../../src/modules/mcp/remote/mcp-remote.client'),
  ]);
  return {
    ...configModule,
    ...readinessModule,
    ...clientModule,
  };
}

describe('MCP remote fail-closed readiness', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps MCP remote disabled and fail-closed by default', async () => {
    const { getMcpRemoteConfig, McpRemoteReadinessService } = await loadRemote();
    const config = getMcpRemoteConfig();
    const readiness = new McpRemoteReadinessService().getReadiness({ server: server(), policy: remotePolicy() });

    expect(config).toMatchObject(failClosedConfig);
    expect(readiness).toMatchObject({
      status: 'disabled',
      failClosed: true,
      remoteEnabled: false,
      discoveryEnabled: false,
      executionEnabled: false,
      credentialsConfigured: false,
    });
  });

  it('keeps remote execution disabled and fail-closed when execution flag is off', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: server(),
      policy: remotePolicy(),
      config: executionDisabledConfig,
    });

    expect(readiness.status).toBe('execution_disabled');
    expect(readiness.failClosed).toBe(true);
    expect(readiness.checks).toContainEqual(expect.objectContaining({ name: 'execution', status: 'fail' }));
  });

  it('marks an active remote server without baseUrl as misconfigured', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: server({ baseUrl: null }),
      policy: remotePolicy(),
      config: enabledConfig,
    });

    expect(readiness).toMatchObject({
      status: 'misconfigured',
      failClosed: true,
      reason: 'MCP remote server is missing baseUrl.',
    });
    expect(readiness.checks).toContainEqual(expect.objectContaining({ name: 'transport', status: 'fail' }));
  });

  it('blocks archived or disabled MCP servers', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: server({ status: 'archived', deletedAt: new Date('2026-06-26T00:00:00.000Z') }),
      policy: remotePolicy(),
      config: enabledConfig,
    });

    expect(readiness.status).toBe('blocked');
    expect(readiness.failClosed).toBe(true);
    expect(readiness.checks).toContainEqual(expect.objectContaining({ name: 'server_status', status: 'fail' }));
  });

  it('requires backend credentials for credentialed auth types without exposing references', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: {
        ...server({ authType: 'bearer' }),
        secretRef: 'vault://mcp/raw-reference',
      } as GovernedMcpRemoteServer,
      policy: remotePolicy(),
      credentialsConfigured: false,
      config: enabledConfig,
    });
    const serialized = JSON.stringify(readiness);

    expect(readiness).toMatchObject({
      status: 'auth_required',
      failClosed: true,
      credentialsConfigured: false,
      authType: 'bearer',
    });
    expect(serialized).not.toContain('vault://mcp/raw-reference');
  });

  it('keeps readiness fail-closed when discovery is disabled', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: server(),
      policy: remotePolicy(),
      config: discoveryDisabledConfig,
    });

    expect(readiness.status).toBe('discovery_disabled');
    expect(readiness.failClosed).toBe(true);
    expect(readiness.checks).toContainEqual(expect.objectContaining({ name: 'discovery', status: 'fail' }));
  });

  it('keeps readiness fail-closed when policy remains blocked by default', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: server(),
      policy: remotePolicy({ allowRuntimeExecution: false, sandboxOnly: true, blockedByDefault: true }),
      config: enabledConfig,
    });

    expect(readiness.status).toBe('execution_disabled');
    expect(readiness.failClosed).toBe(true);
    expect(readiness.checks).toContainEqual(expect.objectContaining({ name: 'policy', status: 'fail' }));
  });

  it('can report structural readiness only when every local gate passes', async () => {
    const { McpRemoteReadinessService } = await loadRemote();
    const readiness = new McpRemoteReadinessService().getReadiness({
      server: server(),
      policy: remotePolicy(),
      config: enabledConfig,
    });

    expect(readiness).toMatchObject({
      status: 'ready',
      failClosed: false,
      remoteEnabled: true,
      discoveryEnabled: true,
      executionEnabled: true,
    });
  });
});

describe('MCP remote client stub', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('rejects raw credential-shaped constructor keys', async () => {
    const { McpRemoteClient } = await loadRemote();
    const unsafeOptions = {
      ...clientOptions(),
      tokenValue: 'raw-credential-fixture',
    };

    expect(() => new McpRemoteClient(unsafeOptions, enabledConfig)).toThrow(expect.objectContaining({
      code: 'MCP_REMOTE_RAW_CREDENTIAL_REJECTED',
    }));
  });

  it('fails health, discovery and execution closed without calling network APIs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { McpRemoteClient } = await loadRemote();
    const client = new McpRemoteClient(clientOptions(), enabledConfig);

    await expect(client.checkHealth()).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_NOT_IMPLEMENTED',
    });
    await expect(client.discoverTools(discoveryRequest())).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_NOT_IMPLEMENTED',
    });
    await expect(client.executeTool(executionSpec())).rejects.toMatchObject({
      status: 409,
      code: 'MCP_REMOTE_NOT_IMPLEMENTED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns controlled disabled errors before any network path', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { McpRemoteClient } = await loadRemote();
    const client = new McpRemoteClient(clientOptions(), failClosedConfig);

    await expect(client.checkHealth()).rejects.toMatchObject({ code: 'MCP_REMOTE_DISABLED' });
    await expect(client.discoverTools(discoveryRequest())).rejects.toMatchObject({ code: 'MCP_REMOTE_DISABLED' });
    await expect(client.executeTool(executionSpec())).rejects.toMatchObject({ code: 'MCP_REMOTE_DISABLED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns controlled discovery and execution disabled errors', async () => {
    const { McpRemoteClient } = await loadRemote();
    const discoveryClient = new McpRemoteClient(clientOptions(), discoveryDisabledConfig);
    const executionClient = new McpRemoteClient(clientOptions(), executionDisabledConfig);

    await expect(discoveryClient.discoverTools(discoveryRequest())).rejects.toMatchObject({
      code: 'MCP_REMOTE_DISCOVERY_DISABLED',
    });
    await expect(executionClient.executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_EXECUTION_DISABLED',
    });
  });
});
