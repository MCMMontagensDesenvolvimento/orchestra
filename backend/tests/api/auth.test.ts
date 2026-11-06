import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/infrastructure/prisma/prisma.service';
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
    user: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

const originalDevLoginEnabled = env.DEV_LOGIN_ENABLED;
const originalNodeEnv = process.env.NODE_ENV;
const date = new Date('2026-06-19T12:00:00.000Z');
const configuredTenantId = '22222222-2222-4222-8222-222222222222';
const configuredClientId = '11111111-1111-4111-8111-111111111111';

type MutableMicrosoftSsoEnv = {
  MICROSOFT_SSO_ENABLED: boolean;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT_ID?: string;
  MICROSOFT_REDIRECT_URI?: string;
  MICROSOFT_ALLOWED_DOMAINS?: string;
  MICROSOFT_ALLOWED_TENANT_IDS?: string;
  MICROSOFT_POST_LOGOUT_REDIRECT_URI?: string;
  MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: boolean;
};

const originalMicrosoftSsoEnv: MutableMicrosoftSsoEnv = {
  MICROSOFT_SSO_ENABLED: env.MICROSOFT_SSO_ENABLED,
  MICROSOFT_CLIENT_ID: env.MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: env.MICROSOFT_CLIENT_SECRET,
  MICROSOFT_TENANT_ID: env.MICROSOFT_TENANT_ID,
  MICROSOFT_REDIRECT_URI: env.MICROSOFT_REDIRECT_URI,
  MICROSOFT_ALLOWED_DOMAINS: env.MICROSOFT_ALLOWED_DOMAINS,
  MICROSOFT_ALLOWED_TENANT_IDS: env.MICROSOFT_ALLOWED_TENANT_IDS,
  MICROSOFT_POST_LOGOUT_REDIRECT_URI: env.MICROSOFT_POST_LOGOUT_REDIRECT_URI,
  MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: env.MICROSOFT_SSO_AUTO_LINK_BY_EMAIL,
};
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

const devLoginUserFixture = {
  id: testUser.id,
  tenantId: testUser.tenant.id,
  email: testUser.email,
  name: testUser.name,
  passwordHash: null,
  status: 'active',
  lastLoginAt: null,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  tenant: {
    id: testUser.tenant.id,
    name: testUser.tenant.name,
    slug: testUser.tenant.slug,
    status: 'active',
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
  },
  roles: [
    {
      id: '00000000-0000-0000-0000-000000000030',
      userId: testUser.id,
      roleId: '00000000-0000-0000-0000-000000000040',
      workspaceId: null,
      createdAt: date,
      role: {
        id: '00000000-0000-0000-0000-000000000040',
        tenantId: testUser.tenant.id,
        name: 'admin_platform',
        description: null,
        createdAt: date,
        updatedAt: date,
        permissions: testUser.permissions.map((permission, index) => ({
          id: `00000000-0000-0000-0000-00000000005${index}`,
          roleId: '00000000-0000-0000-0000-000000000040',
          permissionId: `00000000-0000-0000-0000-00000000006${index}`,
          createdAt: date,
          permission: {
            id: `00000000-0000-0000-0000-00000000006${index}`,
            key: permission,
            description: null,
            createdAt: date,
            updatedAt: date,
          },
        })),
      },
    },
  ],
  memberships: [
    {
      id: '00000000-0000-0000-0000-000000000070',
      userId: testUser.id,
      workspaceId: testUser.workspaces[0].id,
      role: testUser.workspaces[0].role,
      createdAt: date,
      workspace: {
        id: testUser.workspaces[0].id,
        tenantId: testUser.tenant.id,
        name: testUser.workspaces[0].name,
        slug: testUser.workspaces[0].slug,
        description: null,
        status: 'active',
        createdAt: date,
        updatedAt: date,
        deletedAt: null,
      },
    },
  ],
};

function responseCookies(response: request.Response) {
  const value = response.headers['set-cookie'] as unknown;
  if (Array.isArray(value)) return value as string[];
  return typeof value === 'string' ? [value] : [];
}

function setDevLoginEnabled(value: boolean) {
  (env as { DEV_LOGIN_ENABLED: boolean }).DEV_LOGIN_ENABLED = value;
}

function restoreNodeEnv() {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }
  process.env.NODE_ENV = originalNodeEnv;
}

function setMicrosoftSsoEnv(overrides: Partial<MutableMicrosoftSsoEnv> = {}) {
  Object.assign(env as MutableMicrosoftSsoEnv, {
    MICROSOFT_SSO_ENABLED: true,
    MICROSOFT_CLIENT_ID: configuredClientId,
    MICROSOFT_CLIENT_SECRET: 'backend-only-client-secret',
    MICROSOFT_TENANT_ID: configuredTenantId,
    MICROSOFT_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/microsoft/callback',
    MICROSOFT_ALLOWED_DOMAINS: 'mcm.com.br',
    MICROSOFT_ALLOWED_TENANT_IDS: configuredTenantId,
    MICROSOFT_POST_LOGOUT_REDIRECT_URI: 'http://localhost:5173/login',
    MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: false,
    ...overrides,
  });
}

describe('auth endpoints', () => {
  beforeEach(() => {
    env.MICROSOFT_SSO_ENABLED = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    setDevLoginEnabled(originalDevLoginEnabled);
    Object.assign(env as MutableMicrosoftSsoEnv, originalMicrosoftSsoEnv);
    restoreNodeEnv();
  });

  it('returns public sanitized Microsoft SSO readiness without requiring a session', async () => {
    const response = await request(createApp())
      .get('/api/v1/auth/sso/config')
      .expect(200);

    expect(response.body.data).toMatchObject({
      provider: 'microsoft',
      enabled: false,
      loginUrl: '/api/v1/auth/microsoft/start',
    });
    expect(typeof response.body.data.configured).toBe('boolean');
    expect(Array.isArray(response.body.data.allowedDomains)).toBe(true);
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

  it('blocks dev-login when it is not explicitly enabled', async () => {
    setDevLoginEnabled(false);
    process.env.NODE_ENV = 'test';

    const response = await request(createApp())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'admin.dev@orchestra.local' })
      .expect(403);

    expect(response.body.code).toBe('DEV_LOGIN_DISABLED');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('allows dev-login outside production when explicitly enabled', async () => {
    setDevLoginEnabled(true);
    process.env.NODE_ENV = 'test';
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(devLoginUserFixture as any);

    const response = await request(createApp())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'admin.dev@orchestra.local' })
      .expect(200);

    expect(response.body.user.email).toBe('admin.dev@orchestra.local');
    expect(response.body.permissions).toContain('assistants.read');
    expect(responseCookies(response).some((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=`))).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: testUser.id },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('blocks dev-login in production', async () => {
    setDevLoginEnabled(true);
    process.env.NODE_ENV = 'production';

    const response = await request(createApp())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'admin.dev@orchestra.local' })
      .expect(403);

    expect(response.body.code).toBe('DEV_LOGIN_DISABLED');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('clears local session and falls back to login on Microsoft logout when SSO is unavailable', async () => {
    const token = signSession({ sub: testUser.id, user: testUser });
    const response = await request(createApp())
      .get('/api/v1/auth/microsoft/logout')
      .set('Cookie', [`${env.COOKIE_NAME}=${token}`])
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/login');
    expect(responseCookies(response).some((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=;`))).toBe(true);
  });

  it('clears local session and redirects to the Microsoft logout URL when SSO is configured', async () => {
    setMicrosoftSsoEnv();
    const token = signSession({ sub: testUser.id, user: testUser });

    const response = await request(createApp())
      .get('/api/v1/auth/microsoft/logout')
      .set('Cookie', [`${env.COOKIE_NAME}=${token}`])
      .expect(302);

    const location = String(response.headers.location);
    const logoutUrl = new URL(location);
    expect(logoutUrl.origin).toBe('https://login.microsoftonline.com');
    expect(logoutUrl.pathname).toBe(`/${configuredTenantId}/oauth2/v2.0/logout`);
    expect(location).not.toContain('/v2.0/oauth2/v2.0/logout');
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:5173/login');
    expect(location).not.toContain('backend-only-client-secret');
    expect(location).not.toContain('id_token');
    expect(location).not.toContain('access_token');
    expect(location).not.toContain('refresh_token');
    expect(location).not.toContain('authorization_code');
    expect(responseCookies(response).some((cookie) => cookie.startsWith(`${env.COOKIE_NAME}=;`))).toBe(true);
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
