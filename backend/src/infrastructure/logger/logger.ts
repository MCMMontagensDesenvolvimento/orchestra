import pino from 'pino';
import { env } from '../../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.clientSecret',
      '*.client_secret',
      '*.authorizationCode',
      '*.authorization_code',
      '*.idToken',
      '*.id_token',
      '*.accessToken',
      '*.access_token',
      '*.refreshToken',
      '*.refresh_token',
    ],
    censor: '[redacted]',
  },
});
