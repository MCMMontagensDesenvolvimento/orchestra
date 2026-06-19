import { z } from 'zod';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';
import { signSession } from '../../shared/security/session';
import { recordAuditEvent } from '../audit/audit.service';
import { mapUserForAuth } from './auth.mapper';
import { authRepository } from './auth.repository';
import {
  createMicrosoftSsoClient,
  MicrosoftSsoClientError,
  type MicrosoftSsoClientFactory,
} from './microsoft-sso.client';
import {
  getMicrosoftSsoConfiguredRuntimeConfig,
  getMicrosoftSsoPublicConfig,
} from './microsoft-sso.config';
import {
  createMicrosoftSsoTransaction,
  secureTextEquals,
  verifyMicrosoftSsoTransaction,
} from './microsoft-sso.state';
import type {
  MicrosoftSsoClaims,
  MicrosoftSsoEnvironment,
  MicrosoftSsoFailureReason,
} from './microsoft-sso.types';

const callbackQuerySchema = z.object({
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().min(1).max(128).optional(),
}).passthrough();

interface MicrosoftSsoServiceEnvironment extends MicrosoftSsoEnvironment {
  FRONTEND_ORIGIN: string;
  JWT_SECRET: string;
}

interface MicrosoftSsoRequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface MicrosoftSsoServiceDependencies {
  environment: MicrosoftSsoServiceEnvironment;
  repository: Pick<
    typeof authRepository,
    | 'createExternalIdentity'
    | 'findActiveExternalIdentityForUserProvider'
    | 'findExternalIdentityForSso'
    | 'findUsersForSsoAutoLink'
    | 'updateExternalIdentityLogin'
    | 'updateLastLogin'
  >;
  recordAudit: typeof recordAuditEvent;
  clientFactory: MicrosoftSsoClientFactory;
  createSessionToken: typeof signSession;
  now: () => Date;
}

interface MicrosoftSsoCallbackInput {
  query: unknown;
  transactionToken?: string;
}

interface ValidatedClaims {
  email: string;
  emailVerified: boolean;
  displayName?: string;
  issuer: string;
  providerTenantId: string;
  providerUserId: string;
  providerSubjectSource: 'oid' | 'sub';
}

export class MicrosoftSsoFlowError extends Error {
  constructor(readonly reason: MicrosoftSsoFailureReason) {
    super(reason);
    this.name = 'MicrosoftSsoFlowError';
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizedIssuer(value: string) {
  return value.replace(/\/+$/, '').toLowerCase();
}

function claimBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  const text = asString(value)?.toLowerCase();
  return text === 'true';
}

function emailFromClaims(claims: MicrosoftSsoClaims) {
  const email = asString(claims.email);
  if (email) return email.toLowerCase();

  const preferredUsername = asString(claims.preferred_username);
  if (preferredUsername && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preferredUsername)) {
    return preferredUsername.toLowerCase();
  }

  return null;
}

function displayNameFromClaims(claims: MicrosoftSsoClaims) {
  const name = asString(claims.name);
  if (!name) return undefined;
  return name.slice(0, 200);
}

function validateClaims(
  claims: MicrosoftSsoClaims,
  config: NonNullable<ReturnType<typeof getMicrosoftSsoConfiguredRuntimeConfig>>,
  expectedNonce: string,
  now: Date,
): ValidatedClaims | MicrosoftSsoFailureReason {
  const issuer = asString(claims.iss);
  const audience = asString(claims.aud);
  const tenantId = asString(claims.tid)?.toLowerCase();
  const nonce = asString(claims.nonce);
  const oid = asString(claims.oid);
  const sub = asString(claims.sub);
  const expiration = typeof claims.exp === 'number' ? claims.exp : Number.NaN;
  const expectedTenantId = config.tenantId.toLowerCase();
  const expectedIssuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;

  if (
    !issuer
    || normalizedIssuer(issuer) !== normalizedIssuer(expectedIssuer)
    || audience !== config.clientId
    || !Number.isFinite(expiration)
    || expiration <= Math.floor(now.getTime() / 1000)
  ) {
    return 'claims_invalid';
  }

  if (!tenantId || tenantId !== expectedTenantId) return 'tenant_invalid';
  if (config.allowedTenantIds.length > 0 && !config.allowedTenantIds.includes(tenantId)) {
    return 'tenant_invalid';
  }
  if (!nonce || !secureTextEquals(nonce, expectedNonce)) return 'nonce_invalid';

  const email = emailFromClaims(claims);
  if (!email) return 'email_missing';
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (!config.allowedDomains.includes(domain)) return 'domain_invalid';

  const providerUserId = oid || sub;
  if (!providerUserId) return 'external_subject_missing';

  return {
    email,
    emailVerified: claimBoolean(claims.email_verified),
    displayName: displayNameFromClaims(claims),
    issuer: normalizedIssuer(issuer),
    providerTenantId: tenantId,
    providerUserId,
    providerSubjectSource: oid ? 'oid' : 'sub',
  };
}

export function createMicrosoftSsoService(
  overrides: Partial<MicrosoftSsoServiceDependencies> = {},
) {
  const dependencies: MicrosoftSsoServiceDependencies = {
    environment: env,
    repository: authRepository,
    recordAudit: recordAuditEvent,
    clientFactory: createMicrosoftSsoClient,
    createSessionToken: signSession,
    now: () => new Date(),
    ...overrides,
  };

  async function audit(
    action: string,
    context: MicrosoftSsoRequestContext,
    metadata: Record<string, string>,
    user?: { id: string; tenantId: string },
  ) {
    await dependencies.recordAudit({
      tenantId: user?.tenantId,
      actorUserId: user?.id,
      action,
      entity: 'authentication',
      entityId: user?.id,
      metadata,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  async function callbackFailure(
    reason: MicrosoftSsoFailureReason,
    context: MicrosoftSsoRequestContext,
  ): Promise<never> {
    await audit('sso_login_failed', context, {
      provider: 'microsoft',
      stage: 'callback',
      reason,
    });
    throw new MicrosoftSsoFlowError(reason);
  }

  function internalUserFailure(user: {
    status: string;
    deletedAt?: Date | null;
    tenant: {
      status: string;
      deletedAt?: Date | null;
    };
    memberships?: Array<{
      workspace: {
        status: string;
        deletedAt?: Date | null;
      };
    }>;
  }): MicrosoftSsoFailureReason | null {
    if (user.deletedAt || user.status !== 'active') return 'user_inactive';
    if (user.tenant.deletedAt || user.tenant.status !== 'active') return 'tenant_inactive';
    if (
      user.memberships
      && user.memberships.length > 0
      && !user.memberships.some((membership) =>
        membership.workspace.status === 'active' && !membership.workspace.deletedAt)
    ) {
      return 'workspace_unavailable';
    }
    return null;
  }

  return {
    publicConfig() {
      return getMicrosoftSsoPublicConfig(dependencies.environment);
    },

    successRedirectUrl() {
      return new URL('/app/dashboard', dependencies.environment.FRONTEND_ORIGIN).toString();
    },

    errorRedirectUrl(reason: MicrosoftSsoFailureReason) {
      const url = new URL('/login', dependencies.environment.FRONTEND_ORIGIN);
      url.searchParams.set('sso_error', reason);
      return url.toString();
    },

    async start(context: MicrosoftSsoRequestContext) {
      const publicConfig = getMicrosoftSsoPublicConfig(dependencies.environment);
      if (!publicConfig.enabled) {
        await audit('sso_login_failed', context, {
          provider: 'microsoft',
          stage: 'start',
          reason: 'sso_disabled',
        });
        throw new AppError(409, 'SSO_DISABLED', 'Microsoft SSO nao esta habilitado.');
      }

      const config = getMicrosoftSsoConfiguredRuntimeConfig(dependencies.environment);
      if (!config) {
        await audit('sso_login_failed', context, {
          provider: 'microsoft',
          stage: 'start',
          reason: 'sso_misconfigured',
        });
        throw new AppError(503, 'SSO_MISCONFIGURED', 'Microsoft SSO nao esta configurado.');
      }

      const transaction = createMicrosoftSsoTransaction(dependencies.environment.JWT_SECRET);
      try {
        const authorizationUrl = await dependencies.clientFactory(config).getAuthorizationUrl({
          state: transaction.state,
          nonce: transaction.nonce,
          codeChallenge: transaction.codeChallenge,
        });
        await audit('sso_login_started', context, {
          provider: 'microsoft',
          stage: 'start',
        });
        return {
          authorizationUrl,
          transactionToken: transaction.token,
        };
      } catch {
        await audit('sso_login_failed', context, {
          provider: 'microsoft',
          stage: 'start',
          reason: 'authorization_url_failed',
        });
        throw new AppError(502, 'SSO_PROVIDER_UNAVAILABLE', 'Nao foi possivel iniciar Microsoft SSO.');
      }
    },

    async callback(input: MicrosoftSsoCallbackInput, context: MicrosoftSsoRequestContext) {
      try {
        const publicConfig = getMicrosoftSsoPublicConfig(dependencies.environment);
        if (!publicConfig.enabled) return callbackFailure('sso_disabled', context);

        const config = getMicrosoftSsoConfiguredRuntimeConfig(dependencies.environment);
        if (!config) return callbackFailure('sso_misconfigured', context);

        const queryResult = callbackQuerySchema.safeParse(input.query);
        const transaction = verifyMicrosoftSsoTransaction(
          input.transactionToken,
          dependencies.environment.JWT_SECRET,
        );
        if (!queryResult.success || !transaction || !queryResult.data.state) {
          return callbackFailure('state_invalid', context);
        }
        if (!secureTextEquals(queryResult.data.state, transaction.state)) {
          return callbackFailure('state_invalid', context);
        }

        await audit('sso_callback_received', context, {
          provider: 'microsoft',
          stage: 'callback',
        });

        if (queryResult.data.error) return callbackFailure('provider_error', context);
        if (!queryResult.data.code) return callbackFailure('callback_invalid', context);

        let claims: MicrosoftSsoClaims;
        try {
          claims = await dependencies.clientFactory(config).exchangeAuthorizationCode({
            code: queryResult.data.code,
            state: transaction.state,
            nonce: transaction.nonce,
            codeVerifier: transaction.codeVerifier,
          });
        } catch (error) {
          if (error instanceof MicrosoftSsoClientError) {
            return callbackFailure(error.reason, context);
          }
          return callbackFailure('token_exchange_failed', context);
        }

        const validatedClaims = validateClaims(
          claims,
          config,
          transaction.nonce,
          dependencies.now(),
        );
        if (typeof validatedClaims === 'string') {
          return callbackFailure(validatedClaims, context);
        }

        const loginAt = dependencies.now();
        const linkedIdentity = await dependencies.repository.findExternalIdentityForSso({
          provider: 'microsoft',
          providerTenantId: validatedClaims.providerTenantId,
          providerUserId: validatedClaims.providerUserId,
        });

        let user = linkedIdentity?.user;
        let externalIdentityId = linkedIdentity?.id;

        if (linkedIdentity && user) {
          if (linkedIdentity.tenantId !== user.tenantId) {
            return callbackFailure('external_identity_conflict', context);
          }
          const failureReason = internalUserFailure(user);
          if (failureReason) return callbackFailure(failureReason, context);
          await dependencies.repository.updateExternalIdentityLogin({
            id: linkedIdentity.id,
            issuer: validatedClaims.issuer,
            email: validatedClaims.email,
            emailVerified: validatedClaims.emailVerified,
            displayName: validatedClaims.displayName,
            lastLoginAt: loginAt,
          });
        } else {
          if (!dependencies.environment.MICROSOFT_SSO_AUTO_LINK_BY_EMAIL) {
            return callbackFailure('external_identity_not_linked', context);
          }

          const users = await dependencies.repository.findUsersForSsoAutoLink(validatedClaims.email);
          if (users.length === 0) return callbackFailure('user_not_found', context);
          if (users.length > 1) return callbackFailure('external_identity_conflict', context);

          user = users[0];
          const failureReason = internalUserFailure(user);
          if (failureReason) return callbackFailure(failureReason, context);

          const conflictingIdentity = await dependencies.repository.findActiveExternalIdentityForUserProvider({
            provider: 'microsoft',
            userId: user.id,
          });
          if (
            conflictingIdentity
            && (
              conflictingIdentity.providerTenantId !== validatedClaims.providerTenantId
              || conflictingIdentity.providerUserId !== validatedClaims.providerUserId
            )
          ) {
            return callbackFailure('external_identity_conflict', context);
          }

          try {
            const createdIdentity = await dependencies.repository.createExternalIdentity({
              tenantId: user.tenantId,
              userId: user.id,
              provider: 'microsoft',
              providerTenantId: validatedClaims.providerTenantId,
              providerUserId: validatedClaims.providerUserId,
              issuer: validatedClaims.issuer,
              email: validatedClaims.email,
              emailVerified: validatedClaims.emailVerified,
              displayName: validatedClaims.displayName,
              linkedAt: loginAt,
              lastLoginAt: loginAt,
            });
            externalIdentityId = createdIdentity.id;
          } catch {
            return callbackFailure('external_identity_link_failed', context);
          }

          await audit(
            'sso_identity_linked',
            context,
            {
              provider: 'microsoft',
              stage: 'identity_link',
              externalIdentityId,
            },
            {
              id: user.id,
              tenantId: user.tenantId,
            },
          );
        }

        await dependencies.repository.updateLastLogin(user.id);
        const authUser = mapUserForAuth(user);
        const token = dependencies.createSessionToken({
          sub: authUser.id,
          user: authUser,
        });

        await audit(
          'sso_login_succeeded',
          context,
          {
            provider: 'microsoft',
            stage: 'callback',
            ...(externalIdentityId ? { externalIdentityId } : {}),
          },
          {
            id: authUser.id,
            tenantId: authUser.tenant.id,
          },
        );

        return {
          token,
          user: authUser,
          redirectUrl: new URL('/app/dashboard', dependencies.environment.FRONTEND_ORIGIN).toString(),
        };
      } catch (error) {
        if (error instanceof MicrosoftSsoFlowError) throw error;
        return callbackFailure('internal_error', context);
      }
    },
  };
}

export const microsoftSsoService = createMicrosoftSsoService();
