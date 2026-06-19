import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../../config/env';
import type { MicrosoftSsoTransaction } from './microsoft-sso.types';

const TRANSACTION_AUDIENCE = 'orchestra:microsoft-sso';
const TRANSACTION_ISSUER = 'orchestra';
const TRANSACTION_PURPOSE = 'microsoft_sso_transaction';
const TRANSACTION_TTL_SECONDS = 10 * 60;
const TRANSACTION_COOKIE_PATH = '/api/v1/auth/microsoft';

export const MICROSOFT_SSO_TRANSACTION_COOKIE = `${env.COOKIE_NAME}_microsoft_sso`;

interface MicrosoftSsoTransactionPayload extends JwtPayload {
  purpose: typeof TRANSACTION_PURPOSE;
  state: string;
  nonce: string;
  codeVerifier: string;
}

function randomBase64Url(bytes: number) {
  return randomBytes(bytes).toString('base64url');
}

export function createMicrosoftSsoTransaction(
  jwtSecret: string = env.JWT_SECRET,
): MicrosoftSsoTransaction {
  const state = randomBase64Url(32);
  const nonce = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const token = jwt.sign(
    {
      purpose: TRANSACTION_PURPOSE,
      state,
      nonce,
      codeVerifier,
    },
    jwtSecret,
    {
      algorithm: 'HS256',
      audience: TRANSACTION_AUDIENCE,
      issuer: TRANSACTION_ISSUER,
      expiresIn: TRANSACTION_TTL_SECONDS,
    },
  );

  return { state, nonce, codeVerifier, codeChallenge, token };
}

export function verifyMicrosoftSsoTransaction(
  token: string | undefined,
  jwtSecret: string = env.JWT_SECRET,
): MicrosoftSsoTransactionPayload | null {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      audience: TRANSACTION_AUDIENCE,
      issuer: TRANSACTION_ISSUER,
    });

    if (
      typeof payload === 'string'
      || payload.purpose !== TRANSACTION_PURPOSE
      || typeof payload.state !== 'string'
      || typeof payload.nonce !== 'string'
      || typeof payload.codeVerifier !== 'string'
    ) {
      return null;
    }

    return payload as MicrosoftSsoTransactionPayload;
  } catch {
    return null;
  }
}

export function secureTextEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

export function setMicrosoftSsoTransactionCookie(res: Response, token: string) {
  res.cookie(MICROSOFT_SSO_TRANSACTION_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: TRANSACTION_TTL_SECONDS * 1000,
    path: TRANSACTION_COOKIE_PATH,
  });
}

export function readMicrosoftSsoTransactionCookie(req: Request) {
  const value = req.cookies?.[MICROSOFT_SSO_TRANSACTION_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export function clearMicrosoftSsoTransactionCookie(res: Response) {
  res.clearCookie(MICROSOFT_SSO_TRANSACTION_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: TRANSACTION_COOKIE_PATH,
  });
}
