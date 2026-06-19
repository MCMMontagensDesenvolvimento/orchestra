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
