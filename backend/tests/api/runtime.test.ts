import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('returns providers with local current and Agno stub disabled by default', async () => {
    const response = await request(createApp())
      .get('/api/v1/runtime/providers')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.map((provider: { provider: string }) => provider.provider)).toEqual(['local', 'agno_stub', 'agno']);
    expect(response.body.data.find((provider: { provider: string; current: boolean }) => provider.provider === 'local').current).toBe(true);
    expect(response.body.data.find((provider: { provider: string; health: { status: string } }) => provider.provider === 'agno_stub').health.status).toBe('disabled');
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
    expect(JSON.stringify(response.body.data)).not.toContain('AGNO_API_KEY');
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
