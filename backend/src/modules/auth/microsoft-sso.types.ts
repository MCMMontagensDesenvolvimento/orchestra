export interface MicrosoftSsoEnvironment {
  MICROSOFT_SSO_ENABLED: boolean;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT_ID?: string;
  MICROSOFT_REDIRECT_URI?: string;
  MICROSOFT_ALLOWED_DOMAINS?: string;
  MICROSOFT_ALLOWED_TENANT_IDS?: string;
  MICROSOFT_POST_LOGOUT_REDIRECT_URI?: string;
}

export interface MicrosoftSsoPublicConfig {
  provider: 'microsoft';
  enabled: boolean;
  configured: boolean;
  allowedDomains: string[];
  loginUrl: string;
}

export interface MicrosoftSsoConfiguredRuntimeConfig {
  provider: 'microsoft';
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  allowedDomains: string[];
  allowedTenantIds: string[];
  authority: string;
}

export interface MicrosoftSsoTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  token: string;
}

export interface MicrosoftSsoClaims {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  nonce?: unknown;
  preferred_username?: unknown;
  tid?: unknown;
  [key: string]: unknown;
}

export type MicrosoftSsoFailureReason =
  | 'sso_disabled'
  | 'sso_misconfigured'
  | 'authorization_url_failed'
  | 'state_invalid'
  | 'callback_invalid'
  | 'provider_error'
  | 'token_exchange_failed'
  | 'claims_invalid'
  | 'nonce_invalid'
  | 'tenant_invalid'
  | 'domain_invalid'
  | 'email_missing'
  | 'user_not_found'
  | 'user_inactive'
  | 'internal_error';
