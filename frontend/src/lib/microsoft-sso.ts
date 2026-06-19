import type { MicrosoftSsoErrorCode, SsoProviderConfig } from '@/types';

export const MICROSOFT_SSO_LOGIN_URL = '/api/v1/auth/microsoft/start';

const GENERIC_SSO_ERROR_MESSAGE = 'Nao foi possivel concluir o login corporativo. Tente novamente.';

const microsoftSsoErrorMessages: Record<MicrosoftSsoErrorCode, string> = {
  sso_disabled: 'O login corporativo ainda nao esta habilitado para este ambiente.',
  sso_misconfigured: 'O login corporativo ainda nao esta configurado corretamente. Acione o administrador.',
  authorization_url_failed: 'O login corporativo esta temporariamente indisponivel. Tente novamente.',
  state_invalid: 'Nao foi possivel validar a tentativa de login. Tente novamente.',
  callback_invalid: 'Nao foi possivel validar a resposta do login corporativo. Tente novamente.',
  nonce_invalid: 'Nao foi possivel validar a sessao de login. Tente novamente.',
  provider_error: 'A Microsoft retornou uma falha no login. Tente novamente.',
  token_exchange_failed: 'Nao foi possivel concluir o login corporativo agora. Tente novamente.',
  claims_invalid: 'Nao foi possivel validar sua identidade corporativa.',
  tenant_invalid: 'Sua conta Microsoft nao pertence a um tenant autorizado.',
  domain_invalid: 'Use uma conta corporativa com dominio permitido.',
  email_missing: 'Nao foi possivel identificar o e-mail corporativo da sua conta.',
  user_not_found: 'Sua conta ainda nao esta liberada no Orchestra. Solicite acesso ao administrador.',
  user_inactive: 'Seu usuario esta inativo no Orchestra. Solicite suporte ao administrador.',
  internal_error: 'Nao foi possivel concluir o login corporativo agora.',
};

export const microsoftSsoNavigator = {
  assign(loginUrl: string) {
    window.location.assign(loginUrl);
  },
};

export function getMicrosoftSsoErrorMessage(code?: string | null) {
  if (!code?.trim()) return null;
  if (code in microsoftSsoErrorMessages) {
    return microsoftSsoErrorMessages[code as MicrosoftSsoErrorCode];
  }

  return GENERIC_SSO_ERROR_MESSAGE;
}

export function isSafeMicrosoftSsoLoginUrl(loginUrl?: string | null): loginUrl is string {
  return loginUrl === MICROSOFT_SSO_LOGIN_URL;
}

export function canStartMicrosoftSso(config?: SsoProviderConfig | null) {
  return Boolean(config?.enabled && config.configured && isSafeMicrosoftSsoLoginUrl(config.loginUrl));
}

export function redirectToMicrosoftSsoLogin(
  config: SsoProviderConfig,
  navigator = microsoftSsoNavigator,
) {
  if (!canStartMicrosoftSso(config)) return false;
  navigator.assign(config.loginUrl);
  return true;
}
