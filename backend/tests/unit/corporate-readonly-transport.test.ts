import { describe, expect, it, vi } from 'vitest';
import {
  CorporateReadonlyHttpTransport,
  corporateReadonlyToolName,
} from '../../src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport';
import type { CorporateReadonlyConfig } from '../../src/modules/mcp/remote/corporate-readonly/corporate-readonly.config';
import { McpRemoteClient } from '../../src/modules/mcp/remote/mcp-remote.client';
import { FailClosedMcpRemoteClientTransport } from '../../src/modules/mcp/remote/mcp-remote-transport';
import {
  createGovernedMcpRemoteTransport,
  matchesCorporateReadonlyOrigin,
} from '../../src/modules/mcp/remote/mcp-remote-transport.factory';
import type {
  GovernedMcpToolExecutionSpec,
  McpRemoteFeatureConfig,
} from '../../src/modules/mcp/remote/mcp-remote.types';

const corporateOrigin = 'https://status.example.test';
const publicResolver = async () => ['93.184.216.34'];
const corporateConfig: CorporateReadonlyConfig = {
  enabled: true,
  allowedOrigin: corporateOrigin,
  timeoutMs: 1000,
  maxResponseBytes: 4096,
};
const remoteConfig: McpRemoteFeatureConfig = {
  remoteEnabled: true,
  discoveryEnabled: true,
  executionEnabled: true,
  readOnlyEnabled: true,
  egressAllowlist: corporateOrigin,
  defaultTimeoutMs: 1000,
  maxTimeoutMs: 2000,
  maxResponseBytes: 4096,
  requireSecretRef: true,
  allowWriteTools: false,
};

function executionSpec(
  toolOverrides: Partial<GovernedMcpToolExecutionSpec['tool']> = {},
  input: unknown = { scope: 'summary' },
): GovernedMcpToolExecutionSpec {
  return {
    executionId: 'corporate-readonly-execution',
    tenantId: '00000000-0000-0000-0000-000000000010',
    workspaceId: '00000000-0000-0000-0000-000000000020',
    assistantId: '00000000-0000-0000-0000-000000000030',
    mcpServerId: '00000000-0000-0000-0000-000000000040',
    mcpToolId: '00000000-0000-0000-0000-000000000050',
    assistantMcpBindingId: '00000000-0000-0000-0000-000000000060',
    requestedByUserId: '00000000-0000-0000-0000-000000000070',
    mode: 'remote_controlled',
    requestId: 'request-corporate-readonly',
    traceId: 'trace-corporate-readonly',
    tool: {
      externalName: corporateReadonlyToolName,
      displayName: 'Corporate Status Read',
      description: 'Read a non-sensitive corporate homologation status summary.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: { scope: { type: 'string', enum: ['summary', 'availability'] } },
      },
      riskLevel: 'low',
      requiresApproval: false,
      readOnly: true,
      ...toolOverrides,
    },
    policyDecision: {
      status: 'allowed',
      reasons: [],
      allowRuntimeExecution: true,
      sandboxOnly: false,
      blockedByDefault: false,
      approvalSatisfied: true,
    },
    limits: { timeoutMs: 1000, maxInputBytes: 512, maxOutputBytes: 4096 },
    input: { hash: 'synthetic-input-hash', value: input },
  };
}

function response(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  const body = JSON.stringify(payload);
  return new Response(body, {
    status,
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      ...headers,
    },
  });
}

function transportWithResponse(payload: unknown, status = 200) {
  const fetchImplementation = vi.fn<typeof fetch>(async () => response(payload, status));
  const transport = new CorporateReadonlyHttpTransport({
    config: corporateConfig,
    fetchImplementation,
    resolveCredential: async () => 'opaque-test-value',
  });
  return { transport, fetchImplementation };
}

function client(transport: CorporateReadonlyHttpTransport, overrides: Partial<ConstructorParameters<typeof McpRemoteClient>[0]> = {}) {
  return new McpRemoteClient({
    serverId: 'corporate-readonly-server',
    baseUrl: corporateOrigin,
    authType: 'bearer',
    secretRef: 'env://ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
    credentialsConfigured: true,
    timeoutMs: 1000,
    ...overrides,
  }, remoteConfig, { transport, resolveHost: publicResolver });
}

describe('corporate read-only governed transport', () => {
  it('stays fail-closed unless its dedicated flag and exact HTTPS origin match', () => {
    const disabled = { ...corporateConfig, enabled: false };
    const disabledTransport = createGovernedMcpRemoteTransport(
      { baseUrl: corporateOrigin },
      remoteConfig,
      disabled,
    );
    expect(disabledTransport).toBeInstanceOf(FailClosedMcpRemoteClientTransport);
    expect(matchesCorporateReadonlyOrigin(`${corporateOrigin}/v1`, corporateConfig)).toBe(false);
    expect(matchesCorporateReadonlyOrigin(`${corporateOrigin}?mode=test`, corporateConfig)).toBe(false);
    expect(matchesCorporateReadonlyOrigin('http://status.example.test', corporateConfig)).toBe(false);
    expect(matchesCorporateReadonlyOrigin('https://status.example.test.evil.invalid', corporateConfig)).toBe(false);
    expect(createGovernedMcpRemoteTransport(
      { baseUrl: corporateOrigin },
      remoteConfig,
      corporateConfig,
    )).toBeInstanceOf(CorporateReadonlyHttpTransport);
  });

  it.each([
    'https://127.0.0.1',
    'https://10.0.0.1',
    'https://169.254.169.254',
    'https://metadata.google.internal',
  ])('blocks private and metadata-style destinations before the corporate transport: %s', async (blockedOrigin) => {
    const fetchImplementation = vi.fn();
    const transport = new CorporateReadonlyHttpTransport({
      config: { ...corporateConfig, allowedOrigin: blockedOrigin },
      fetchImplementation,
      resolveCredential: async () => 'opaque-test-value',
    });
    const privateClient = new McpRemoteClient({
      serverId: 'corporate-private-server',
      baseUrl: blockedOrigin,
      authType: 'bearer',
      secretRef: 'env://ORCHESTRA_CORPORATE_READONLY_STATUS_TOKEN',
      credentialsConfigured: true,
      timeoutMs: 1000,
    }, { ...remoteConfig, egressAllowlist: blockedOrigin }, { transport });

    await expect(privateClient.executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_EGRESS_BLOCKED',
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('requires a logical secret reference before any request', async () => {
    const { transport, fetchImplementation } = transportWithResponse({});
    const missingReferenceClient = client(transport, { secretRef: null, credentialsConfigured: false });

    await expect(missingReferenceClient.executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_SECRET_REF_REQUIRED',
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('uses one fixed GET endpoint and accepts the strict 16V status payload', async () => {
    const { transport, fetchImplementation } = transportWithResponse({
      status: 'ok',
      summary: 'Orchestra operational',
      updatedAt: '2026-07-21T12:00:00.000Z',
    });
    const result = await client(transport).executeTool(executionSpec());

    expect(result).toMatchObject({
      status: 'completed',
      externalMcpCalled: true,
      simulated: false,
      remoteHost: 'status.example.test',
    });
    expect(JSON.parse(result.content ?? '{}')).toEqual({
      status: 'ok',
      summary: 'Orchestra operational',
      updatedAt: '2026-07-21T12:00:00.000Z',
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe(`${corporateOrigin}/v1/corporate-readonly/status`);
    expect(init).toEqual(expect.objectContaining({ method: 'GET', redirect: 'manual' }));
    expect(init?.headers).toEqual(expect.objectContaining({
      accept: 'application/json',
      authorization: ['Bearer', 'opaque-test-value'].join(' '),
    }));
  });

  it('accepts the strict 16V availability payload through its fixed GET endpoint', async () => {
    const { transport, fetchImplementation } = transportWithResponse({
      status: 'degraded',
      summary: 'Orchestra availability endpoint operational',
      updatedAt: '2026-07-21T12:00:00.000Z',
    });
    const result = await client(transport).executeTool(executionSpec({}, {
      scope: 'availability',
    }));

    expect(JSON.parse(result.content ?? '{}')).toEqual({
      status: 'degraded',
      summary: 'Orchestra availability endpoint operational',
      updatedAt: '2026-07-21T12:00:00.000Z',
    });
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe(`${corporateOrigin}/v1/corporate-readonly/status/availability`);
    expect(init).toEqual(expect.objectContaining({ method: 'GET', redirect: 'manual' }));
  });

  it('normalizes the legacy health payload without propagating requestId or service', async () => {
    const requestIdMarker = 'req_SYNTHETIC_HEALTH_MARKER';
    const { transport, fetchImplementation } = transportWithResponse({
      status: 'ok',
      service: 'orchestra-backend',
      timestamp: '2026-07-21T12:00:00.000Z',
      requestId: requestIdMarker,
    });
    const readiness = await client(transport).checkHealth();

    expect(readiness).toMatchObject({
      status: 'ready',
      transportChecked: true,
      transportHealthy: true,
      simulated: false,
    });
    expect(JSON.stringify(readiness)).not.toContain(requestIdMarker);
    expect(JSON.stringify(readiness)).not.toContain('orchestra-backend');
    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url).toBe(`${corporateOrigin}/v1/corporate-readonly/health`);
    expect(init).toEqual(expect.objectContaining({ method: 'GET', redirect: 'manual' }));
  });

  it('discovers the single read-only tool only after the authenticated health path succeeds', async () => {
    const { transport, fetchImplementation } = transportWithResponse({
      status: 'ok',
      service: 'orchestra-backend',
      timestamp: '2026-08-17T12:00:00.000Z',
      requestId: 'req_synthetic_discovery',
    });
    const discovery = await client(transport).discoverTools({
      tenantId: '00000000-0000-0000-0000-000000000010',
      workspaceId: '00000000-0000-0000-0000-000000000020',
      serverId: 'corporate-readonly-server',
      requestedByUserId: '00000000-0000-0000-0000-000000000070',
      requestId: 'request-corporate-discovery',
      mode: 'dry_run',
      timeoutMs: 1000,
    });

    expect(discovery.tools).toHaveLength(1);
    expect(discovery.tools[0]?.externalName).toBe(corporateReadonlyToolName);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      `${corporateOrigin}/v1/corporate-readonly/health`,
    );
  });

  it('never falls back to the public health path after an authenticated target failure', async () => {
    const { transport, fetchImplementation } = transportWithResponse({}, 404);

    await expect(client(transport).checkHealth()).rejects.toMatchObject({
      code: 'MCP_REMOTE_TRANSPORT_FAILED',
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      `${corporateOrigin}/v1/corporate-readonly/health`,
    );
  });

  it.each([
    {
      label: 'an unexpected status',
      payload: {
        status: 'maintenance',
        summary: 'Orchestra operational',
        updatedAt: '2026-07-21T12:00:00.000Z',
      },
    },
    {
      label: 'a missing summary',
      payload: {
        status: 'ok',
        updatedAt: '2026-07-21T12:00:00.000Z',
      },
    },
    {
      label: 'a missing updatedAt',
      payload: {
        status: 'ok',
        summary: 'Orchestra operational',
      },
    },
    {
      label: 'an invalid updatedAt',
      payload: {
        status: 'ok',
        summary: 'Orchestra operational',
        updatedAt: '2026-07-21',
      },
    },
    {
      label: 'an extra non-contract field',
      payload: {
        status: 'ok',
        summary: 'Orchestra operational',
        updatedAt: '2026-07-21T12:00:00.000Z',
        internalNote: 'not accepted',
      },
    },
    {
      label: 'HTML in summary',
      payload: {
        status: 'ok',
        summary: '<strong>Orchestra operational</strong>',
        updatedAt: '2026-07-21T12:00:00.000Z',
      },
    },
    {
      label: 'an oversized summary',
      payload: {
        status: 'ok',
        summary: 'x'.repeat(241),
        updatedAt: '2026-07-21T12:00:00.000Z',
      },
    },
  ])('fails closed on $label in a 16V payload', async ({ payload }) => {
    const { transport } = transportWithResponse(payload);

    await expect(client(transport).executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_TRANSPORT_FAILED',
      message: 'MCP remote transport failed.',
    });
  });

  it('blocks write-like tools and unsupported input before invoking the transport', async () => {
    const { transport, fetchImplementation } = transportWithResponse({});
    const governedClient = client(transport);

    await expect(governedClient.executeTool(executionSpec({
      externalName: 'corporate.status.delete',
      readOnly: false,
    }))).rejects.toMatchObject({ code: 'MCP_REMOTE_TOOL_NOT_READONLY' });
    await expect(governedClient.executeTool(executionSpec({}, {
      scope: 'summary',
      endpoint: 'not-accepted',
    }))).rejects.toMatchObject({ code: 'MCP_REMOTE_POLICY_BLOCKED' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('fails safely on redirects and response fields shaped like raw payload', async () => {
    const secretMarker = 'SYNTHETIC_CREDENTIAL_VALUE';
    const redirectFetch = vi.fn(async () => response({}, 302, { location: 'https://other.example.test' }));
    const redirectTransport = new CorporateReadonlyHttpTransport({
      config: corporateConfig,
      fetchImplementation: redirectFetch,
      resolveCredential: async () => secretMarker,
    });
    let redirectFailure: unknown;
    try {
      await client(redirectTransport).executeTool(executionSpec());
    } catch (error) {
      redirectFailure = error;
    }
    expect(redirectFailure).toMatchObject({
      code: 'MCP_REMOTE_EGRESS_BLOCKED',
      message: 'MCP remote destination was blocked.',
    });
    expect(JSON.stringify(redirectFailure)).not.toContain(secretMarker);

    const rawMarker = 'SYNTHETIC_RAW_VALUE_MUST_NOT_LEAK';
    const { transport } = transportWithResponse({
      status: 'ok',
      summary: 'Safe summary.',
      updatedAt: '2026-07-21T12:00:00.000Z',
      rawOutput: rawMarker,
    });
    let failure: unknown;
    try {
      await client(transport).executeTool(executionSpec());
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: 'MCP_REMOTE_TRANSPORT_FAILED',
      message: 'MCP remote transport failed.',
    });
    expect(JSON.stringify(failure)).not.toContain(rawMarker);
  });

  it('enforces the governed response byte limit before mapping content', async () => {
    const payload = {
      status: 'ok',
      summary: 'Orchestra operational',
      updatedAt: '2026-07-21T12:00:00.000Z',
    };
    const fetchImplementation = vi.fn<typeof fetch>(async () => response(payload));
    const transport = new CorporateReadonlyHttpTransport({
      config: { ...corporateConfig, maxResponseBytes: 32 },
      fetchImplementation,
      resolveCredential: async () => 'opaque-test-value',
    });

    await expect(client(transport).executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_RESPONSE_TOO_LARGE',
      message: 'MCP remote response exceeded the governed limit.',
    });
  });

  it('aborts a corporate request at the dedicated transport timeout', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('synthetic abort')), { once: true });
    }));
    const transport = new CorporateReadonlyHttpTransport({
      config: { ...corporateConfig, timeoutMs: 5 },
      fetchImplementation,
      resolveCredential: async () => 'opaque-test-value',
    });

    await expect(client(transport).executeTool(executionSpec())).rejects.toMatchObject({
      code: 'MCP_REMOTE_TRANSPORT_FAILED',
      message: 'MCP remote transport failed.',
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});
