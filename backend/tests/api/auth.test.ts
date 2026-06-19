import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

vi.mock('../../src/infrastructure/prisma/prisma.service', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

const testUser: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: ['assistants.read', 'assistants.create'],
};

describe('auth endpoints', () => {
  it('returns public sanitized Microsoft SSO readiness without requiring a session', async () => {
    const response = await request(createApp())
      .get('/api/v1/auth/sso/config')
      .expect(200);

    expect(response.body.data).toEqual({
      provider: 'microsoft',
      enabled: false,
      configured: false,
      allowedDomains: [],
      loginUrl: '/api/v1/auth/microsoft/start',
    });
    expect(response.body.requestId).toMatch(/^req_/);

    const serialized = JSON.stringify(response.body).toLowerCase();
    expect(serialized).not.toContain('client_secret');
    expect(serialized).not.toContain('id_token');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('authorization_code');
  });

  it('returns 401 for auth/me without session', async () => {
    const response = await request(createApp()).get('/api/v1/auth/me').expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.requestId).toMatch(/^req_/);
  });

  it('returns user for auth/me with dev session cookie', async () => {
    const token = signSession({ sub: testUser.id, user: testUser });
    const response = await request(createApp())
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${token}`])
      .expect(200);

    expect(response.body.user.email).toBe('admin.dev@orchestra.local');
    expect(response.body.tenant.slug).toBe('orchestra-dev');
    expect(response.body.workspaces[0].slug).toBe('default');
    expect(response.body.permissions).toContain('assistants.read');
  });

  it('blocks dev-login in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const response = await request(createApp())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'admin.dev@orchestra.local' })
      .expect(403);

    process.env.NODE_ENV = previousNodeEnv;
    expect(response.body.code).toBe('DEV_LOGIN_DISABLED');
  });

  it('clears session on logout', async () => {
    const token = signSession({ sub: testUser.id, user: testUser });
    const response = await request(createApp())
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${env.COOKIE_NAME}=${token}`])
      .expect(204);

    expect(response.headers['set-cookie'][0]).toContain(`${env.COOKIE_NAME}=`);
  });

  it('returns 403 when permission is missing', async () => {
    const token = signSession({ sub: testUser.id, user: { ...testUser, permissions: [] } });
    const response = await request(createApp())
      .get('/api/v1/workspaces')
      .set('Cookie', [`${env.COOKIE_NAME}=${token}`])
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
    expect(response.body.requestId).toMatch(/^req_/);
  });

  it('returns 422 with fieldErrors and requestId for invalid params', async () => {
    const token = signSession({ sub: testUser.id, user: testUser });
    const response = await request(createApp())
      .get('/api/v1/assistants/not-a-uuid')
      .set('Cookie', [`${env.COOKIE_NAME}=${token}`])
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.fieldErrors[0].field).toBe('id');
    expect(response.body.requestId).toMatch(/^req_/);
  });
});
