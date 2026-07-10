import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000001';

const originalRuntimeEnv = {
  RUNTIME_PROVIDER: env.RUNTIME_PROVIDER,
  RUNTIME_ADAPTER_ENABLED: env.RUNTIME_ADAPTER_ENABLED,
  RUNTIME_ALLOW_EXTERNAL_TOOLS: env.RUNTIME_ALLOW_EXTERNAL_TOOLS,
  AGNO_ENABLED: env.AGNO_ENABLED,
  AGNO_EXECUTION_ENABLED: env.AGNO_EXECUTION_ENABLED,
  AGNO_BASE_URL: env.AGNO_BASE_URL,
  AGNO_API_KEY: env.AGNO_API_KEY,
  AGNO_HEALTHCHECK_ENABLED: env.AGNO_HEALTHCHECK_ENABLED,
  AGNO_RUNTIME_HTTP_ENABLED: env.AGNO_RUNTIME_HTTP_ENABLED,
  AGNO_RUNTIME_HTTP_BASE_URL: env.AGNO_RUNTIME_HTTP_BASE_URL,
  AGNO_RUNTIME_HTTP_SECURITY_KEY: env.AGNO_RUNTIME_HTTP_SECURITY_KEY,
};

function configureRuntime(overrides: Partial<typeof originalRuntimeEnv> = {}) {
  Object.assign(env, {
    ...originalRuntimeEnv,
    RUNTIME_PROVIDER: 'local',
    RUNTIME_ADAPTER_ENABLED: true,
    RUNTIME_ALLOW_EXTERNAL_TOOLS: false,
    AGNO_ENABLED: false,
    AGNO_EXECUTION_ENABLED: false,
    AGNO_BASE_URL: undefined,
    AGNO_API_KEY: undefined,
    AGNO_HEALTHCHECK_ENABLED: false,
    AGNO_RUNTIME_HTTP_ENABLED: false,
    AGNO_RUNTIME_HTTP_BASE_URL: undefined,
    AGNO_RUNTIME_HTTP_SECURITY_KEY: undefined,
    ...overrides,
  });
}

const testUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: workspaceId,
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: ['agent_runs.read'],
};

function sessionCookie(user: AuthenticatedUser = testUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

describe('runtime adapter boundary endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureRuntime();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  afterAll(() => {
    configureRuntime(originalRuntimeEnv);
  });

  it('returns providers with local current and Agno stub disabled by default', async () => {
    const response = await request(createApp())
      .get('/api/v1/runtime/providers')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.map((provider: { provider: string }) => provider.provider)).toEqual(['local', 'agno_stub', 'agno', 'agno_http']);
    expect(response.body.data.find((provider: { provider: string; current: boolean }) => provider.provider === 'local').current).toBe(true);
    expect(response.body.data.find((provider: { provider: string; health: { status: string } }) => provider.provider === 'agno_stub').health.status).toBe('disabled');
    expect(response.body.data.find((provider: { provider: string; health: { status: string } }) => provider.provider === 'agno_http').health.status).toBe('disabled');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'agno_adapter_readiness_checked' }));
  });

  it('returns local capabilities and health', async () => {
    const capabilities = await request(createApp())
      .get('/api/v1/runtime/capabilities')
      .set('Cookie', [sessionCookie()])
      .expect(200);
    const health = await request(createApp())
      .get('/api/v1/runtime/health')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(capabilities.body.data.provider).toBe('local');
    expect(capabilities.body.data.supportsSandbox).toBe(true);
    expect(capabilities.body.data.supportsExternalProviders).toBe(false);
    expect(health.body.data.status).toBe('healthy');
  });

  it('returns sanitized runtime config without secrets', async () => {
    const response = await request(createApp())
      .get('/api/v1/runtime/config')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.provider).toBe('local');
    expect(response.body.data.agnoEnabled).toBe(false);
    expect(response.body.data.agnoConfigured).toBe(false);
    expect(response.body.data.agnoHttpEnabled).toBe(false);
    expect(response.body.data.agnoHttpConfigured).toBe(false);
    expect(JSON.stringify(response.body.data)).not.toContain('AGNO_API_KEY');
    expect(JSON.stringify(response.body.data)).not.toContain('AGNO_RUNTIME_HTTP_SECURITY_KEY');
    expect(JSON.stringify(response.body.data)).not.toContain('127.0.0.1:8091');
    expect(JSON.stringify(response.body.data).toLowerCase()).not.toContain('secret');
  });

  it('protects runtime endpoints with auth and permissions', async () => {
    await request(createApp()).get('/api/v1/runtime/health').expect(401);

    const response = await request(createApp())
      .get('/api/v1/runtime/health')
      .set('Cookie', [sessionCookie({ ...testUser, permissions: [] })])
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
  });
});
