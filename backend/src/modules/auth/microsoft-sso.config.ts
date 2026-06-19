import { env } from '../../config/env';
import type {
  MicrosoftSsoConfiguredRuntimeConfig,
  MicrosoftSsoEnvironment,
  MicrosoftSsoPublicConfig,
} from './microsoft-sso.types';

const MICROSOFT_LOGIN_URL = '/api/v1/auth/microsoft/start';
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedList(value?: string, normalizeCase = false) {
  if (!value) return [];

  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeCase ? item.toLowerCase() : item);

  return [...new Set(values)];
}

function resolveMicrosoftSsoConfig(source: MicrosoftSsoEnvironment) {
  const domainCandidates = normalizedList(source.MICROSOFT_ALLOWED_DOMAINS, true);
  const allowedDomains = domainCandidates.filter((domain) => domainPattern.test(domain));
  const tenantCandidates = normalizedList(source.MICROSOFT_ALLOWED_TENANT_IDS, true);
  const allowedTenantIds = tenantCandidates.filter((tenantId) => uuidPattern.test(tenantId));
  const tenantId = source.MICROSOFT_TENANT_ID?.trim();
  const domainsValid = allowedDomains.length > 0
    && allowedDomains.length === domainCandidates.length;
  const tenantsValid = allowedTenantIds.length === tenantCandidates.length;
  const tenantAllowed = tenantCandidates.length === 0
    || Boolean(tenantId && allowedTenantIds.includes(tenantId.toLowerCase()));

  const configured = Boolean(
    source.MICROSOFT_CLIENT_ID
    && source.MICROSOFT_CLIENT_SECRET
    && tenantId
    && source.MICROSOFT_REDIRECT_URI
    && source.MICROSOFT_POST_LOGOUT_REDIRECT_URI
    && domainsValid
    && tenantsValid
    && tenantAllowed,
  );

  return {
    allowedDomains,
    allowedTenantIds,
    configured,
    tenantId,
  };
}

export function getMicrosoftSsoPublicConfig(
  source: MicrosoftSsoEnvironment = env,
): MicrosoftSsoPublicConfig {
  const config = resolveMicrosoftSsoConfig(source);

  return {
    provider: 'microsoft',
    enabled: source.MICROSOFT_SSO_ENABLED,
    configured: config.configured,
    allowedDomains: config.allowedDomains,
    loginUrl: MICROSOFT_LOGIN_URL,
  };
}

export function getMicrosoftSsoConfiguredRuntimeConfig(
  source: MicrosoftSsoEnvironment = env,
): MicrosoftSsoConfiguredRuntimeConfig | null {
  const config = resolveMicrosoftSsoConfig(source);
  if (
    !config.configured
    || !source.MICROSOFT_CLIENT_ID
    || !source.MICROSOFT_CLIENT_SECRET
    || !config.tenantId
    || !source.MICROSOFT_REDIRECT_URI
    || !source.MICROSOFT_POST_LOGOUT_REDIRECT_URI
  ) {
    return null;
  }

  return {
    provider: 'microsoft',
    clientId: source.MICROSOFT_CLIENT_ID,
    clientSecret: source.MICROSOFT_CLIENT_SECRET,
    tenantId: config.tenantId,
    redirectUri: source.MICROSOFT_REDIRECT_URI,
    postLogoutRedirectUri: source.MICROSOFT_POST_LOGOUT_REDIRECT_URI,
    allowedDomains: config.allowedDomains,
    allowedTenantIds: config.allowedTenantIds,
    authority: `https://login.microsoftonline.com/${config.tenantId}`,
  };
}
