import {
  ClientAuthError,
  ClientAuthErrorCodes,
  ConfidentialClientApplication,
  LogLevel,
  type Configuration,
} from '@azure/msal-node';
import type {
  MicrosoftSsoClaims,
  MicrosoftSsoConfiguredRuntimeConfig,
} from './microsoft-sso.types';

export const MICROSOFT_SSO_SCOPES = ['openid', 'profile', 'email'];

export interface MicrosoftAuthorizationRequest {
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface MicrosoftTokenExchangeRequest {
  code: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface MicrosoftSsoClient {
  getAuthorizationUrl(input: MicrosoftAuthorizationRequest): Promise<string>;
  exchangeAuthorizationCode(input: MicrosoftTokenExchangeRequest): Promise<MicrosoftSsoClaims>;
}

export class MicrosoftSsoClientError extends Error {
  constructor(readonly reason: 'nonce_invalid' | 'token_exchange_failed') {
    super(reason);
    this.name = 'MicrosoftSsoClientError';
  }
}

export type MicrosoftSsoClientFactory = (
  config: MicrosoftSsoConfiguredRuntimeConfig,
) => MicrosoftSsoClient;

export const createMicrosoftSsoClient: MicrosoftSsoClientFactory = (config) => {
  const msalConfig: Configuration = {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      clientSecret: config.clientSecret,
    },
    system: {
      loggerOptions: {
        loggerCallback: () => undefined,
        logLevel: LogLevel.Error,
        piiLoggingEnabled: false,
      },
    },
  };
  const application = new ConfidentialClientApplication(msalConfig);

  return {
    async getAuthorizationUrl(input) {
      return application.getAuthCodeUrl({
        scopes: MICROSOFT_SSO_SCOPES,
        redirectUri: config.redirectUri,
        responseMode: 'query',
        prompt: 'select_account',
        state: input.state,
        nonce: input.nonce,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: 'S256',
      });
    },

    async exchangeAuthorizationCode(input) {
      try {
        const result = await application.acquireTokenByCode(
          {
            code: input.code,
            scopes: MICROSOFT_SSO_SCOPES,
            redirectUri: config.redirectUri,
            codeVerifier: input.codeVerifier,
            state: input.state,
          },
          {
            code: input.code,
            state: input.state,
            nonce: input.nonce,
          },
        );
        return result.idTokenClaims as MicrosoftSsoClaims;
      } catch (error) {
        if (
          error instanceof ClientAuthError
          && error.errorCode === ClientAuthErrorCodes.nonceMismatch
        ) {
          throw new MicrosoftSsoClientError('nonce_invalid');
        }
        throw new MicrosoftSsoClientError('token_exchange_failed');
      } finally {
        const tokenCache = application.getTokenCache();
        const accounts = await tokenCache.getAllAccounts();
        await Promise.all(accounts.map((account) => tokenCache.removeAccount(account)));
      }
    },
  };
};
