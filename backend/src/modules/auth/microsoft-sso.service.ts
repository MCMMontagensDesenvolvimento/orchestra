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
  repository: Pick<typeof authRepository, 'findUserForSso' | 'updateLastLogin'>;
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

function emailFromClaims(claims: MicrosoftSsoClaims) {
  const email = asString(claims.email);
  if (email) return email.toLowerCase();

  const preferredUsername = asString(claims.preferred_username);
  if (preferredUsername && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preferredUsername)) {
    return preferredUsername.toLowerCase();
  }

  return null;
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

  return { email };
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

        const user = await dependencies.repository.findUserForSso(validatedClaims.email);
        if (!user) return callbackFailure('user_not_found', context);
        if (user.status !== 'active') return callbackFailure('user_inactive', context);

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
