import { env } from '../../config/env';
import type {
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

export function getMicrosoftSsoPublicConfig(
  source: MicrosoftSsoEnvironment = env,
): MicrosoftSsoPublicConfig {
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
    provider: 'microsoft',
    enabled: source.MICROSOFT_SSO_ENABLED,
    configured,
    allowedDomains,
    loginUrl: MICROSOFT_LOGIN_URL,
  };
}
