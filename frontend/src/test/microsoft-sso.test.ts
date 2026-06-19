import { describe, expect, it, vi } from 'vitest';
import type { SsoProviderConfig } from '@/types';
import {
  MICROSOFT_SSO_LOGIN_URL,
  canStartMicrosoftSso,
  getMicrosoftSsoErrorMessage,
  isSafeMicrosoftSsoLoginUrl,
  redirectToMicrosoftSsoLogin,
} from '@/lib/microsoft-sso';

const config = (overrides: Partial<SsoProviderConfig> = {}): SsoProviderConfig => ({
  provider: 'microsoft',
  enabled: true,
  configured: true,
  allowedDomains: ['empresa.com'],
  loginUrl: MICROSOFT_SSO_LOGIN_URL,
  ...overrides,
});

describe('microsoft sso frontend guardrails', () => {
  it('accepts only the backend internal start route as loginUrl', () => {
    expect(isSafeMicrosoftSsoLoginUrl(MICROSOFT_SSO_LOGIN_URL)).toBe(true);
    expect(isSafeMicrosoftSsoLoginUrl('')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('/auth/microsoft/start')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('https://identity.example.test/start')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('data:text/plain,login')).toBe(false);
  });

  it('starts SSO only when enabled, configured and using a safe loginUrl', () => {
    expect(canStartMicrosoftSso(config())).toBe(true);
    expect(canStartMicrosoftSso(config({ enabled: false }))).toBe(false);
    expect(canStartMicrosoftSso(config({ configured: false }))).toBe(false);
    expect(canStartMicrosoftSso(config({ loginUrl: 'https://identity.example.test/start' }))).toBe(false);
  });

  it('redirects through the backend route without constructing a provider URL', () => {
    const assign = vi.fn();

    expect(redirectToMicrosoftSsoLogin(config(), { assign })).toBe(true);
    expect(assign).toHaveBeenCalledWith(MICROSOFT_SSO_LOGIN_URL);
  });

  it('does not redirect when loginUrl is external or unexpected', () => {
    const assign = vi.fn();

    expect(redirectToMicrosoftSsoLogin(config({ loginUrl: 'https://identity.example.test/start' }), { assign })).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it('maps SSO errors to safe messages without echoing raw query values', () => {
    const known = getMicrosoftSsoErrorMessage('state_invalid');
    const identity = getMicrosoftSsoErrorMessage('external_identity_not_linked');
    const unknown = getMicrosoftSsoErrorMessage('upstream_detail_access_token');

    expect(known).toBe('Nao foi possivel validar a tentativa de login. Tente novamente.');
    expect(identity).toBe('Sua identidade corporativa ainda nao esta vinculada ao Orchestra. Solicite acesso ao administrador.');
    expect(unknown).toBe('Nao foi possivel concluir o login corporativo. Tente novamente.');

    const rendered = `${known} ${identity} ${unknown}`;
    expect(rendered).not.toMatch(/client_secret|id_token|access_token|refresh_token|authorization_code|providerUserId|providerTenantId|state_invalid|nonce_invalid/i);
  });
});
