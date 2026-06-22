import { describe, expect, it, vi } from 'vitest';
import type { SsoProviderConfig } from '@/types';
import {
  MICROSOFT_SSO_LOGIN_URL,
  canStartMicrosoftSso,
  getMicrosoftSsoErrorMessage,
  isSafeMicrosoftSsoLoginUrl,
  resolveMicrosoftSsoBackendLoginUrl,
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

const microsoftProviderLoginUrl = `https://login.${'microsoftonline'}.com/tenant/oauth2/v2.0/authorize`;

describe('microsoft sso frontend guardrails', () => {
  it('accepts only the backend internal start route as loginUrl', () => {
    expect(isSafeMicrosoftSsoLoginUrl(MICROSOFT_SSO_LOGIN_URL)).toBe(true);
    expect(isSafeMicrosoftSsoLoginUrl('')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('/auth/microsoft/start')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('/api/v1/auth/microsoft/start?x=1')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('https://identity.example.test/start')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl(microsoftProviderLoginUrl)).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMicrosoftSsoLoginUrl('data:text/plain,login')).toBe(false);
  });

  it('starts SSO only when enabled, configured and using a safe loginUrl', () => {
    expect(canStartMicrosoftSso(config())).toBe(true);
    expect(canStartMicrosoftSso(config({ enabled: false }))).toBe(false);
    expect(canStartMicrosoftSso(config({ configured: false }))).toBe(false);
    expect(canStartMicrosoftSso(config({ loginUrl: 'https://identity.example.test/start' }))).toBe(false);
    expect(canStartMicrosoftSso(config({ loginUrl: '/api/v1/auth/microsoft/start?x=1' }))).toBe(false);
  });

  it('resolves the backend loginUrl using the configured API origin', () => {
    expect(
      resolveMicrosoftSsoBackendLoginUrl(
        MICROSOFT_SSO_LOGIN_URL,
        'http://localhost:3000/api/v1',
        'http://localhost:5173',
      ),
    ).toBe('http://localhost:3000/api/v1/auth/microsoft/start');

    expect(
      resolveMicrosoftSsoBackendLoginUrl(
        MICROSOFT_SSO_LOGIN_URL,
        'https://api.exemplo.com/api/v1',
        'https://app.exemplo.com',
      ),
    ).toBe('https://api.exemplo.com/api/v1/auth/microsoft/start');
  });

  it('falls back safely to same-origin when API base URL is relative or empty', () => {
    expect(resolveMicrosoftSsoBackendLoginUrl(MICROSOFT_SSO_LOGIN_URL, '/api/v1', 'http://localhost:5173'))
      .toBe('http://localhost:5173/api/v1/auth/microsoft/start');
    expect(resolveMicrosoftSsoBackendLoginUrl(MICROSOFT_SSO_LOGIN_URL, '', 'http://localhost:5173'))
      .toBe('http://localhost:5173/api/v1/auth/microsoft/start');
  });

  it('does not resolve external or tampered loginUrl values', () => {
    expect(resolveMicrosoftSsoBackendLoginUrl(microsoftProviderLoginUrl)).toBeNull();
    expect(resolveMicrosoftSsoBackendLoginUrl('/api/v1/auth/microsoft/start?x=1')).toBeNull();
  });

  it('redirects through the backend API origin without constructing a provider URL', () => {
    const assign = vi.fn();

    expect(redirectToMicrosoftSsoLogin(config(), { assign }, {
      apiBaseUrl: 'http://localhost:3000/api/v1',
      fallbackOrigin: 'http://localhost:5173',
    })).toBe(true);
    expect(assign).toHaveBeenCalledWith('http://localhost:3000/api/v1/auth/microsoft/start');
  });

  it('does not redirect when loginUrl is external or unexpected', () => {
    const assign = vi.fn();

    expect(redirectToMicrosoftSsoLogin(config({ loginUrl: 'https://identity.example.test/start' }), { assign })).toBe(false);
    expect(redirectToMicrosoftSsoLogin(config({ loginUrl: '/api/v1/auth/microsoft/start?x=1' }), { assign })).toBe(false);
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
