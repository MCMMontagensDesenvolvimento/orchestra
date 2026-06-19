import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import {
  MicrosoftSsoFlowError,
  microsoftSsoService,
} from '../../src/modules/auth/microsoft-sso.service';
import { MICROSOFT_SSO_TRANSACTION_COOKIE } from '../../src/modules/auth/microsoft-sso.state';
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

function responseCookies(response: request.Response) {
  const value = response.headers['set-cookie'] as unknown;
  if (Array.isArray(value)) return value as string[];
  return typeof value === 'string' ? [value] : [];
}

describe('auth endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('fails safely when Microsoft SSO start is disabled', async () => {
    const response = await request(createApp())
      .get('/api/v1/auth/microsoft/start')
      .expect(409);

    expect(response.body.code).toBe('SSO_DISABLED');
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('client_secret');
  });

  it('sets a short-lived HttpOnly transaction cookie before redirecting to Microsoft', async () => {
    vi.spyOn(microsoftSsoService, 'start').mockResolvedValueOnce({
      authorizationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
      transactionToken: 'signed-transaction-token',
    });

    const response = await request(createApp())
      .get('/api/v1/auth/microsoft/start')
      .expect(302);

    expect(response.headers.location).toMatch(/^https:\/\/login\.microsoftonline\.com\//);
    const cookie = responseCookies(response).find(
      (value: string) => value.startsWith(`${MICROSOFT_SSO_TRANSACTION_COOKIE}=`),
    );
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth/microsoft');
    expect(cookie).toContain('Max-Age=600');
    expect(JSON.stringify(response.headers)).not.toContain('client_secret');
  });

  it('creates the Orchestra session and clears the transaction cookie on callback success', async () => {
    const token = signSession({ sub: testUser.id, user: testUser });
    vi.spyOn(microsoftSsoService, 'callback').mockResolvedValueOnce({
      token,
      user: testUser,
      redirectUrl: 'http://localhost:5173/app/dashboard',
    });

    const response = await request(createApp())
      .get('/api/v1/auth/microsoft/callback?code=sensitive-code&state=sensitive-state')
      .set('Cookie', [`${MICROSOFT_SSO_TRANSACTION_COOKIE}=signed-transaction-token`])
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/app/dashboard');
    const cookies = responseCookies(response);
    expect(cookies.some((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=`))).toBe(true);
    expect(cookies.some((cookie) =>
      cookie.startsWith(`${MICROSOFT_SSO_TRANSACTION_COOKIE}=;`)
      && cookie.includes('Path=/api/v1/auth/microsoft'),
    )).toBe(true);
    expect(JSON.stringify(response.headers)).not.toContain('sensitive-code');

    const sessionCookie = cookies
      .find((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=`))
      ?.split(';')[0];
    expect(sessionCookie).toBeTruthy();
    const meResponse = await request(createApp())
      .get('/api/v1/auth/me')
      .set('Cookie', [sessionCookie!])
      .expect(200);
    expect(meResponse.body.user.email).toBe(testUser.email);
  });

  it('redirects callback failures with a sanitized code and clears transaction state', async () => {
    vi.spyOn(microsoftSsoService, 'callback')
      .mockRejectedValueOnce(new MicrosoftSsoFlowError('state_invalid'));

    const response = await request(createApp())
      .get('/api/v1/auth/microsoft/callback?code=sensitive-code&state=invalid')
      .set('Cookie', [`${MICROSOFT_SSO_TRANSACTION_COOKIE}=invalid-transaction`])
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/login?sso_error=state_invalid');
    const cookies = responseCookies(response);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain(`${MICROSOFT_SSO_TRANSACTION_COOKIE}=;`);
    expect(JSON.stringify(response.headers)).not.toContain('sensitive-code');
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
