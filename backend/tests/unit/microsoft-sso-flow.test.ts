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
  MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: false,
  MICROSOFT_SSO_AUTO_PROVISION_ENABLED: false,
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

const externalIdentityFixture = {
  id: '00000000-0000-0000-0000-000000000080',
  tenantId: userFixture!.tenantId,
  userId: userFixture!.id,
  provider: 'microsoft',
  providerTenantId: tenantId,
  providerUserId: 'external-oid-1',
  issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  email: 'admin@mcm.com.br',
  emailVerified: false,
  displayName: null,
  lastLoginAt: null,
  linkedAt: date,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  user: userFixture!,
} as Awaited<ReturnType<typeof authRepository.findExternalIdentityForSso>>;

function createFixture(overrides: {
  environment?: Partial<typeof configuredEnvironment>;
  claims?: (nonce: string) => MicrosoftSsoClaims;
  linkedIdentity?: Awaited<ReturnType<typeof authRepository.findExternalIdentityForSso>>;
  autoLinkUsers?: Awaited<ReturnType<typeof authRepository.findUsersForSsoAutoLink>>;
  conflictingIdentity?: Awaited<ReturnType<typeof authRepository.findActiveExternalIdentityForUserProvider>>;
  createIdentityError?: Error;
  provisionError?: Error;
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
      email_verified: true,
      name: 'Admin MCM',
      oid: 'external-oid-1',
      sub: 'external-sub-1',
    };
  });
  const client: MicrosoftSsoClient = {
    getAuthorizationUrl,
    exchangeAuthorizationCode,
  };
  const findExternalIdentityForSso = vi.fn<typeof authRepository.findExternalIdentityForSso>()
    .mockResolvedValue(
      overrides.linkedIdentity === undefined ? externalIdentityFixture : overrides.linkedIdentity,
    );
  const findUsersForSsoAutoLink = vi.fn<typeof authRepository.findUsersForSsoAutoLink>()
    .mockResolvedValue(overrides.autoLinkUsers ?? [userFixture!]);
  const findActiveExternalIdentityForUserProvider = vi
    .fn<typeof authRepository.findActiveExternalIdentityForUserProvider>()
    .mockResolvedValue(overrides.conflictingIdentity ?? null);
  const createExternalIdentity = vi.fn<typeof authRepository.createExternalIdentity>()
    .mockImplementation(async (input) => {
      if (overrides.createIdentityError) throw overrides.createIdentityError;
      return {
        id: '00000000-0000-0000-0000-000000000081',
        tenantId: input.tenantId,
        userId: input.userId,
        provider: input.provider,
        providerTenantId: input.providerTenantId,
        providerUserId: input.providerUserId,
        issuer: input.issuer,
        email: input.email,
        emailVerified: input.emailVerified,
        displayName: input.displayName ?? null,
        lastLoginAt: input.lastLoginAt,
        linkedAt: input.linkedAt,
        createdAt: date,
        updatedAt: date,
        deletedAt: null,
      };
    });
  const provisionMicrosoftSsoUser = vi.fn<typeof authRepository.provisionMicrosoftSsoUser>()
    .mockImplementation(async (input) => {
      if (overrides.provisionError) throw overrides.provisionError;
      return {
        user: {
          ...userFixture!,
          email: input.email,
          name: input.displayName ?? input.email,
          roles: userFixture!.roles.map((item) => ({
            ...item, role: { ...item.role, name: 'consumer' },
          })),
          memberships: userFixture!.memberships.map((item) => ({
            ...item, role: 'member',
          })),
          externalIdentities: [{ id: '00000000-0000-0000-0000-000000000082' }],
        },
        externalIdentityId: '00000000-0000-0000-0000-000000000082',
      } as Awaited<ReturnType<typeof authRepository.provisionMicrosoftSsoUser>>;
    });
  const updateExternalIdentityLogin = vi.fn<typeof authRepository.updateExternalIdentityLogin>()
    .mockResolvedValue({
      ...externalIdentityFixture!,
      user: undefined,
      lastLoginAt: now,
    } as Awaited<ReturnType<typeof authRepository.updateExternalIdentityLogin>>);
  const updateLastLogin = vi.fn<typeof authRepository.updateLastLogin>()
    .mockResolvedValue(undefined);
  const recordAudit = vi.fn<typeof recordAuditEvent>().mockResolvedValue(undefined);
  const service = createMicrosoftSsoService({
    environment: {
      ...configuredEnvironment,
      ...overrides.environment,
    },
    repository: {
      createExternalIdentity,
      provisionMicrosoftSsoUser,
      findActiveExternalIdentityForUserProvider,
      findExternalIdentityForSso,
      findUsersForSsoAutoLink,
      updateExternalIdentityLogin,
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
    createExternalIdentity,
    provisionMicrosoftSsoUser,
    findActiveExternalIdentityForUserProvider,
    findExternalIdentityForSso,
    findUsersForSsoAutoLink,
    updateExternalIdentityLogin,
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

  it('builds a backend-owned Microsoft logout URL when SSO is enabled and configured', () => {
    const fixture = createFixture();

    const logoutUrl = new URL(fixture.service.logoutRedirectUrl());

    expect(logoutUrl.origin).toBe('https://login.microsoftonline.com');
    expect(logoutUrl.pathname).toBe(`/${tenantId}/oauth2/v2.0/logout`);
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:5173/login');
    expect(logoutUrl.toString()).not.toContain('backend-only-client-secret');
  });

  it('falls back to the frontend login page for Microsoft logout when SSO is disabled', () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_ENABLED: false },
    });

    expect(fixture.service.logoutRedirectUrl()).toBe('http://localhost:5173/login');
  });

  it('does not use a configured Microsoft logout redirect outside the frontend origin', () => {
    const fixture = createFixture({
      environment: { MICROSOFT_POST_LOGOUT_REDIRECT_URI: 'https://example.invalid/logout' },
    });

    const logoutUrl = new URL(fixture.service.logoutRedirectUrl());

    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:5173/login');
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
      oid: 'external-oid-1',
    })],
    ['tenant_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: '33333333-3333-4333-8333-333333333333',
      nonce,
      exp: Math.floor(now.getTime() / 1000) + 3600,
      email: 'admin@mcm.com.br',
      oid: 'external-oid-1',
    })],
    ['domain_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce,
      exp: Math.floor(now.getTime() / 1000) + 3600,
      email: 'admin@external.example',
      oid: 'external-oid-1',
    })],
    ['claims_invalid', (nonce: string) => ({
      iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      aud: clientId,
      tid: tenantId,
      nonce,
      exp: Math.floor(now.getTime() / 1000) - 1,
      email: 'admin@mcm.com.br',
      oid: 'external-oid-1',
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
    expect(fixture.findExternalIdentityForSso).not.toHaveBeenCalled();
  });

  it('rejects login without an existing external identity when auto-link is disabled', async () => {
    const fixture = createFixture({ linkedIdentity: null });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'external_identity_not_linked',
    );
    expect(fixture.findUsersForSsoAutoLink).not.toHaveBeenCalled();
    expect(fixture.createExternalIdentity).not.toHaveBeenCalled();
    expect(fixture.updateLastLogin).not.toHaveBeenCalled();
  });

  it('provisions a new MCM user as consumer through Microsoft SSO opt-in', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_PROVISION_ENABLED: true },
      linkedIdentity: null,
      autoLinkUsers: [],
    });
    const { start, transaction } = await startAndTransaction(fixture);
    const result = await fixture.service.callback({
      query: { code: 'authorization-code', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext);
    expect(result.user.email).toBe('admin@mcm.com.br');
    expect(result.user.roles).toContain('consumer');
    expect(result.user.roles).not.toContain('admin_platform');
    expect(result.user.workspaces[0].role).toBe('member');
    expect(fixture.provisionMicrosoftSsoUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'admin@mcm.com.br', providerUserId: 'external-oid-1',
    }));
    expect(fixture.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'sso_user_provisioned',
      metadata: expect.objectContaining({ role: 'consumer' }),
    }));
  });

  it('never provisions over an existing unlinked user', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_PROVISION_ENABLED: true },
      linkedIdentity: null,
      autoLinkUsers: [userFixture!],
    });
    const { start, transaction } = await startAndTransaction(fixture);
    await expectCallbackFailure(fixture.service.callback({
      query: { code: 'authorization-code', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext), 'external_identity_not_linked');
    expect(fixture.provisionMicrosoftSsoUser).not.toHaveBeenCalled();
  });

  it('does not provision a new account with only an unstable sub', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_PROVISION_ENABLED: true },
      linkedIdentity: null,
      autoLinkUsers: [],
      claims: (nonce) => ({
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        aud: clientId, tid: tenantId, nonce,
        exp: Math.floor(now.getTime() / 1000) + 3600,
        email: 'new@mcm.com.br', sub: 'fallback-sub',
      }),
    });
    const { start, transaction } = await startAndTransaction(fixture);
    await expectCallbackFailure(fixture.service.callback({
      query: { code: 'authorization-code', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext), 'external_subject_missing');
    expect(fixture.provisionMicrosoftSsoUser).not.toHaveBeenCalled();
  });

  it('fails closed when atomic SSO provisioning fails', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_PROVISION_ENABLED: true },
      linkedIdentity: null,
      autoLinkUsers: [],
      provisionError: new Error('DB constraint details must not leak'),
    });
    const { start, transaction } = await startAndTransaction(fixture);
    await expectCallbackFailure(fixture.service.callback({
      query: { code: 'authorization-code', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext), 'user_provision_failed');
    expect(fixture.updateLastLogin).not.toHaveBeenCalled();
    expect(JSON.stringify(fixture.recordAudit.mock.calls)).not.toContain('DB constraint details');
  });

  it('rejects an inactive internal user', async () => {
    const fixture = createFixture({
      linkedIdentity: {
        ...externalIdentityFixture!,
        user: {
          ...userFixture!,
          status: 'inactive',
        },
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

  it('rejects a linked identity when the internal tenant is inactive', async () => {
    const fixture = createFixture({
      linkedIdentity: {
        ...externalIdentityFixture!,
        user: {
          ...userFixture!,
          tenant: {
            ...userFixture!.tenant,
            status: 'inactive',
          },
        },
      },
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'tenant_inactive',
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
        oid: 'external-oid-1',
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
    expect(fixture.findExternalIdentityForSso).toHaveBeenCalledWith({
      provider: 'microsoft',
      providerTenantId: tenantId,
      providerUserId: 'external-oid-1',
    });
    expect(fixture.findUsersForSsoAutoLink).not.toHaveBeenCalled();
    expect(fixture.updateExternalIdentityLogin).toHaveBeenCalledWith({
      id: externalIdentityFixture!.id,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      email: 'admin@mcm.com.br',
      emailVerified: false,
      displayName: undefined,
      lastLoginAt: now,
    });
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
        externalIdentityId: externalIdentityFixture!.id,
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

  it('auto-links an existing internal user by email only when explicitly enabled', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: true },
      linkedIdentity: null,
    });
    const { start, transaction } = await startAndTransaction(fixture);

    const result = await fixture.service.callback({
      query: { code: 'authorization-code-sensitive', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext);

    const session = verifySession(result.token);
    expect(session.user.id).toBe(userFixture!.id);
    expect(fixture.findUsersForSsoAutoLink).toHaveBeenCalledWith('admin@mcm.com.br');
    expect(fixture.findActiveExternalIdentityForUserProvider).toHaveBeenCalledWith({
      provider: 'microsoft',
      userId: userFixture!.id,
    });
    expect(fixture.createExternalIdentity).toHaveBeenCalledWith({
      tenantId: userFixture!.tenantId,
      userId: userFixture!.id,
      provider: 'microsoft',
      providerTenantId: tenantId,
      providerUserId: 'external-oid-1',
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      email: 'admin@mcm.com.br',
      emailVerified: true,
      displayName: 'Admin MCM',
      linkedAt: now,
      lastLoginAt: now,
    });
    expect(fixture.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'sso_identity_linked',
      actorUserId: userFixture!.id,
      metadata: {
        provider: 'microsoft',
        stage: 'identity_link',
        externalIdentityId: '00000000-0000-0000-0000-000000000081',
      },
    }));

    const serializedAudit = JSON.stringify(fixture.recordAudit.mock.calls).toLowerCase();
    expect(serializedAudit).not.toContain('admin@mcm.com.br');
    expect(serializedAudit).not.toContain('authorization-code-sensitive');
    expect(serializedAudit).not.toContain('client_secret');
  });

  it('does not auto-provision a user when auto-link by email finds nobody', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: true },
      linkedIdentity: null,
      autoLinkUsers: [],
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'user_not_found',
    );
    expect(fixture.createExternalIdentity).not.toHaveBeenCalled();
    expect(fixture.updateLastLogin).not.toHaveBeenCalled();
  });

  it('rejects auto-link when the internal user already has a different Microsoft identity', async () => {
    const fixture = createFixture({
      environment: { MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: true },
      linkedIdentity: null,
      conflictingIdentity: {
        ...externalIdentityFixture!,
        providerUserId: 'different-external-oid',
      },
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'external_identity_conflict',
    );
    expect(fixture.createExternalIdentity).not.toHaveBeenCalled();
  });

  it('rejects claims without oid and sub', async () => {
    const fixture = createFixture({
      claims: (nonce) => ({
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        aud: clientId,
        tid: tenantId,
        nonce,
        exp: Math.floor(now.getTime() / 1000) + 3600,
        email: 'admin@mcm.com.br',
      }),
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await expectCallbackFailure(
      fixture.service.callback({
        query: { code: 'authorization-code', state: transaction.state },
        transactionToken: start.transactionToken,
      }, requestContext),
      'external_subject_missing',
    );
    expect(fixture.findExternalIdentityForSso).not.toHaveBeenCalled();
  });

  it('prefers oid over sub when both are present', async () => {
    const fixture = createFixture({
      claims: (nonce) => ({
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        aud: clientId,
        tid: tenantId,
        nonce,
        exp: Math.floor(now.getTime() / 1000) + 3600,
        email: 'admin@mcm.com.br',
        oid: 'preferred-oid',
        sub: 'fallback-sub',
      }),
      linkedIdentity: {
        ...externalIdentityFixture!,
        providerUserId: 'preferred-oid',
      },
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await fixture.service.callback({
      query: { code: 'authorization-code', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext);

    expect(fixture.findExternalIdentityForSso).toHaveBeenCalledWith(expect.objectContaining({
      providerUserId: 'preferred-oid',
    }));
  });

  it('uses sub as a documented fallback when oid is missing', async () => {
    const fixture = createFixture({
      claims: (nonce) => ({
        iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        aud: clientId,
        tid: tenantId,
        nonce,
        exp: Math.floor(now.getTime() / 1000) + 3600,
        email: 'admin@mcm.com.br',
        sub: 'fallback-sub',
      }),
      linkedIdentity: {
        ...externalIdentityFixture!,
        providerUserId: 'fallback-sub',
      },
    });
    const { start, transaction } = await startAndTransaction(fixture);

    await fixture.service.callback({
      query: { code: 'authorization-code', state: transaction.state },
      transactionToken: start.transactionToken,
    }, requestContext);

    expect(fixture.findExternalIdentityForSso).toHaveBeenCalledWith(expect.objectContaining({
      providerUserId: 'fallback-sub',
    }));
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
