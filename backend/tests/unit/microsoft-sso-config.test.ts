import { describe, expect, it } from 'vitest';
import { getMicrosoftSsoPublicConfig } from '../../src/modules/auth/microsoft-sso.config';
import type { MicrosoftSsoEnvironment } from '../../src/modules/auth/microsoft-sso.types';

const configuredEnvironment: MicrosoftSsoEnvironment = {
  MICROSOFT_SSO_ENABLED: true,
  MICROSOFT_CLIENT_ID: '11111111-1111-4111-8111-111111111111',
  MICROSOFT_CLIENT_SECRET: 'backend-only-client-secret',
  MICROSOFT_TENANT_ID: '22222222-2222-4222-8222-222222222222',
  MICROSOFT_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/microsoft/callback',
  MICROSOFT_ALLOWED_DOMAINS: ' MCM.com.br,example.com,mcm.com.br ',
  MICROSOFT_ALLOWED_TENANT_IDS: '22222222-2222-4222-8222-222222222222',
  MICROSOFT_POST_LOGOUT_REDIRECT_URI: 'http://localhost:5173/login',
  MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: false,
  MICROSOFT_SSO_AUTO_PROVISION_ENABLED: false,
};

describe('Microsoft SSO public config', () => {
  it('normalizes allowlists and returns only sanitized readiness fields', () => {
    const config = getMicrosoftSsoPublicConfig(configuredEnvironment);

    expect(config).toEqual({
      provider: 'microsoft',
      enabled: true,
      configured: true,
      allowedDomains: ['mcm.com.br', 'example.com'],
      loginUrl: '/api/v1/auth/microsoft/start',
    });

    const serialized = JSON.stringify(config).toLowerCase();
    expect(serialized).not.toContain('backend-only-client-secret');
    expect(serialized).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(serialized).not.toContain('22222222-2222-4222-8222-222222222222');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('code');
  });

  it('stays unconfigured when a backend-only requirement is missing', () => {
    const config = getMicrosoftSsoPublicConfig({
      ...configuredEnvironment,
      MICROSOFT_CLIENT_SECRET: undefined,
    });

    expect(config.enabled).toBe(true);
    expect(config.configured).toBe(false);
  });

  it('stays unconfigured when the primary tenant is outside the tenant allowlist', () => {
    const config = getMicrosoftSsoPublicConfig({
      ...configuredEnvironment,
      MICROSOFT_ALLOWED_TENANT_IDS: '33333333-3333-4333-8333-333333333333',
    });

    expect(config.configured).toBe(false);
  });

  it('stays unconfigured and omits malformed allowlist entries', () => {
    const config = getMicrosoftSsoPublicConfig({
      ...configuredEnvironment,
      MICROSOFT_ALLOWED_DOMAINS: 'mcm.com.br,not a domain',
    });

    expect(config.configured).toBe(false);
    expect(config.allowedDomains).toEqual(['mcm.com.br']);
  });
});
