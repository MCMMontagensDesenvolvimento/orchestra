import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

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
    expect(response.body.user.permissions).toContain('assistants.read');
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
});
