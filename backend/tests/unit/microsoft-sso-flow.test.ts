import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/shared/errors/app-error';
import { verifySession } from '../../src/shared/security/session';
import type { recordAuditEvent } from '../../src/modules/audit/audit.service';
import type { authRepository } from '../../src/modules/auth/auth.repository';
import {
  MicrosoftSsoClientError,
  type MicrosoftAuthorizationRequest,
  type MicrosoftSsoClient,
  type MicrosoftTokenExchangeRequest,
} from '../../src/modules/auth/microsoft-sso.client';
import {
  createMicrosoftSsoService,
  MicrosoftSsoFlowError,
} from '../../src/modules/auth/microsoft-sso.service';
import { verifyMicrosoftSsoTransaction } from '../../src/modules/auth/microsoft-sso.state';
import type { MicrosoftSsoClaims } from '../../src/modules/auth/microsoft-sso.types';

const tenantId = '22222222-2222-4222-8222-222222222222';
const clientId = '11111111-1111-4111-8111-111111111111';
const jwtSecret = 'test-secret-change-me';
const now = new Date('2026-06-19T12:00:00.000Z');

const configuredEnvironment = {
  MICROSOFT_SSO_ENABLED: true,
  MICROSOFT_CLIENT_ID: clientId,
  MICROSOFT_CLIENT_SECRET: 'backend-only-client-secret',
  MICROSOFT_TENANT_ID: tenantId,
  MICROSOFT_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/microsoft/callback',
  MICROSOFT_ALLOWED_DOMAINS: 'mcm.com.br',
  MICROSOFT_ALLOWED_TENANT_IDS: tenantId,
  MICROSOFT_POST_LOGOUT_REDIRECT_URI: 'http://localhost:5173/login',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: jwtSecret,
};

const requestContext = {
  requestId: 'req_sso_test',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

const date = new Date('2026-06-19T10:00:00.000Z');
const userFixture = {
  id: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-000000000010',
  email: 'admin@mcm.com.br',
  name: 'SSO Admin',
  passwordHash: null,
  status: 'active',
  lastLoginAt: null,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  tenant: {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'MCM',
    slug: 'mcm',
    status: 'active',
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
  },
  roles: [
    {
      id: '00000000-0000-0000-0000-000000000030',
      userId: '00000000-0000-0000-0000-000000000001',
      roleId: '00000000-0000-0000-0000-000000000040',
      workspaceId: null,
      createdAt: date,
      role: {
        id: '00000000-0000-0000-0000-000000000040',
        tenantId: '00000000-0000-0000-0000-000000000010',
        name: 'admin_platform',
        description: null,
        createdAt: date,
        updatedAt: date,
        permissions: [
          {
            id: '00000000-0000-0000-0000-000000000050',
            roleId: '00000000-0000-0000-0000-000000000040',
            permissionId: '00000000-0000-0000-0000-000000000060',
            createdAt: date,
            permission: {
              id: '00000000-0000-0000-0000-000000000060',
              key: 'assistants.read',
              description: null,
              createdAt: date,
              updatedAt: date,
            },
          },
        ],
      },
    },
  ],
  memberships: [
    {
      id: '00000000-0000-0000-0000-000000000070',
      userId: '00000000-0000-0000-0000-000000000001',
      workspaceId: '00000000-0000-0000-0000-000000000020',
      role: 'admin',
      createdAt: date,
      workspace: {
        id: '00000000-0000-0000-0000-000000000020',
        tenantId: '00000000-0000-0000-0000-000000000010',
        name: 'Default',
        slug: 'default',
        description: null,
        status: 'active',
        createdAt: date,
        updatedAt: date,
        deletedAt: null,
      },
    },
  ],
} as Awaited<ReturnType<typeof authRepository.findUserForSso>>;

function createFixture(overrides: {
  environment?: Partial<typeof configuredEnvironment>;
  claims?: (nonce: string) => MicrosoftSsoClaims;
  user?: Awaited<ReturnType<typeof authRepository.findUserForSso>>;
  exchangeError?: Error;
} = {}) {
  let authorizationRequest: MicrosoftAuthorizationRequest | undefined;
  let exchangeRequest: MicrosoftTokenExchangeRequest | undefined;
  const getAuthorizationUrl = vi.fn(async (input: MicrosoftAuthorizationRequest) => {
    authorizationRequest = input;
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
  });
  const exchangeAuthorizationCode = vi.fn(async (input: MicrosoftTokenExchangeRequest) => {
    exchangeRequest = input;
    if (overrides.exchangeError) throw overrides.exchangeError;
    return overrides.claims?.(input.nonce) ?? {
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce: input.nonce,
      exp: Math.floor(now.getTime() / 1000) + 3600,
      email: 'Admin@MCM.com.br',
    };
  });
  const client: MicrosoftSsoClient = {
    getAuthorizationUrl,
    exchangeAuthorizationCode,
  };
  const findUserForSso = vi.fn<typeof authRepository.findUserForSso>()
    .mockResolvedValue(overrides.user === undefined ? userFixture : overrides.user);
  const updateLastLogin = vi.fn<typeof authRepository.updateLastLogin>()
    .mockResolvedValue(undefined);
  const recordAudit = vi.fn<typeof recordAuditEvent>().mockResolvedValue(undefined);
  const service = createMicrosoftSsoService({
    environment: {
      ...configuredEnvironment,
      ...overrides.environment,
    },
    repository: {
      findUserForSso,
      updateLastLogin,
    },
    recordAudit,
    clientFactory: () => client,
    now: () => now,
  });

  return {
    service,
    getAuthorizationUrl,
    exchangeAuthorizationCode,
    findUserForSso,
    updateLastLogin,
    recordAudit,
    get authorizationRequest() {
      return authorizationRequest;
    },
    get exchangeRequest() {
      return exchangeRequest;
    },
  };
}

async function startAndTransaction(fixture: ReturnType<typeof createFixture>) {
  const start = await fixture.service.start(requestContext);
  const transaction = verifyMicrosoftSsoTransaction(start.transactionToken, jwtSecret);
  expect(transaction).not.toBeNull();
  return {
    start,
    transaction: transaction!,
  };
}

async function expectCallbackFailure(
  promise: Promise<unknown>,
  reason: MicrosoftSsoFlowError['reason'],
) {
  await expect(promise).rejects.toMatchObject({
    name: 'MicrosoftSsoFlowError',
    reason,
  });
}

describe('Microsoft SSO backend flow', () => {
  it('fails closed when SSO is disabled', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_ENABLED: false },
    });

    await expect(fixture.service.start(requestContext)).rejects.toMatchObject({
      code: 'SSO_DISABLED',
      status: 409,
    } satisfies Partial<AppError>);
    expect(fixture.getAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('fails closed when SSO is enabled but incomplete', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_CLIENT_SECRET: undefined },
    });

    await expect(fixture.service.start(requestContext)).rejects.toMatchObject({
      code: 'SSO_MISCONFIGURED',
      status: 503,
    } satisfies Partial<AppError>);
    expect(fixture.getAuthorizationUrl).not.toHaveBeenCalled();
  });

  it('creates state, nonce and S256 PKCE without exposing private config', async () => {
    const fixture = createFixture();
    const { start, transaction } = await startAndTransaction(fixture);

    expect(start.authorizationUrl).toMatch(/^https:\/\/login\.microsoftonline\.com\//);
    expect(fixture.authorizationRequest).toEqual({
      state: transaction.state,
      nonce: transaction.nonce,
      codeChallenge: createHash('sha256')
        .update(transaction.codeVerifier)
        .digest('base64url'),
    });
    expect(transaction.state).toHaveLength(43);
    expect(transaction.nonce).toHaveLength(43);
    expect(transaction.codeVerifier.length).toBeGreaterThanOrEqual(64);
    expect(JSON.stringify(start)).not.toContain('backend-only-client-secret');
  });

  it('rejects an invalid state before exchanging the code', async () => {
    const fixture = createFixture();
    const { start } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: 'invalid-state' },
        transactionToken: start.transactionToken,
      }, requestContext),
      'state_invalid',
    );
    expect(fixture.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it.each([
    ['nonce_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce: `${nonce}-invalid`,
      exp: Math.floor(now.getTime() / 1000) + 3600,
      email: 'admin@mcm.com.br',
    })],
    ['tenant_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: '33333333-3333-4333-8333-333333333333',
      nonce,
      exp: Math.floor(now.getTime() / 1000) + 3600,
      email: 'admin@mcm.com.br',
    })],
    ['domain_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce,
      exp: Math.floor(now.getTime() / 1000) + 3600,
      email: 'admin@external.example',
    })],
    ['claims_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce,
      exp: Math.floor(now.getTime() / 1000) - 1,
      email: 'admin@mcm.com.br',
    })],
    ['email_missing', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce,
      exp: Math.floor(now.getTime() / 1000) + 3600,
    })],
  ] as const)('rejects callback claims with %s', async (reason, claims) => {
    const fixture = createFixture({ claims });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      reason,
    );
    expect(fixture.findUserForSso).not.toHaveBeenCalled();
  });

  it('rejects an unknown internal user without auto-provisioning', async () => {
    const fixture = createFixture({ user: null });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'user_not_found',
    );
    expect(fixture.updateLastLogin).not.toHaveBeenCalled();
  });

  it('rejects an inactive internal user', async () => {
    const fixture = createFixture({
      user: {
        ...userFixture!,
        status: 'inactive',
      },
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'user_inactive',
    );
    expect(fixture.updateLastLogin).not.toHaveBeenCalled();
  });

  it('maps preferred_username, creates an Orchestra session and keeps audit sanitized', async () => {
    const fixture = createFixture({
      claims: (nonce) => ({
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        aud: clientId,
        tid: tenantId,
        nonce,
        exp: Math.floor(now.getTime() / 1000) + 3600,
        preferred_username: 'Admin@MCM.com.br',
      }),
    });
    const { start, transaction } = await startAndTransaction(fixture);

    const result = await fixture.service.callback({
      query: { code: 'authorization-code-sensitive', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext);

    const session = verifySession(result.token);
    expect(session.user.email).toBe('admin@mcm.com.br');
    expect(session.user.permissions).toContain('assistants.read');
    expect(result.redirectUrl).toBe('http://localhost:5173/app/dashboard');
    expect(fixture.findUserForSso).toHaveBeenCalledWith('admin@mcm.com.br');
    expect(fixture.updateLastLogin).toHaveBeenCalledWith(userFixture!.id);
    expect(fixture.exchangeRequest).toEqual({
      code: 'authorization-code-sensitive',
      state: transaction.state,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    });
    expect(fixture.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'sso_login_succeeded',
      actorUserId: userFixture!.id,
      metadata: {
        provider: 'microsoft',
        stage: 'callback',
      },
    }));

    const serializedAudit = JSON.stringify(fixture.recordAudit.mock.calls).toLowerCase();
    expect(serializedAudit).not.toContain('authorization-code-sensitive');
    expect(serializedAudit).not.toContain('backend-only-client-secret');
    expect(serializedAudit).not.toContain('admin@mcm.com.br');
    expect(serializedAudit).not.toContain('id_token');
    expect(serializedAudit).not.toContain('access_token');
    expect(serializedAudit).not.toContain('refresh_token');
  });

  it('maps upstream exchange failures to a governed sanitized error', async () => {
    const fixture = createFixture({
      exchangeError: new Error('upstream id_token access_token client_secret detail'),
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code-sensitive', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'token_exchange_failed',
    );

    const serializedAudit = JSON.stringify(fixture.recordAudit.mock.calls).toLowerCase();
    expect(serializedAudit).not.toContain('authorization-code-sensitive');
    expect(serializedAudit).not.toContain('upstream');
    expect(serializedAudit).not.toContain('client_secret');
  });

  it('preserves the governed nonce reason reported by MSAL', async () => {
    const fixture = createFixture({
      exchangeError: new MicrosoftSsoClientError('nonce_invalid'),
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code-sensitive', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'nonce_invalid',
    );
  });
});
