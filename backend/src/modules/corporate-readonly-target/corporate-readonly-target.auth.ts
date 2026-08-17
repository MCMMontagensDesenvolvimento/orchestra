import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import {
  getCorporateReadonlyTargetConfig,
  isValidCorporateReadonlyTargetToken,
  type CorporateReadonlyTargetConfig,
} from './corporate-readonly-target.config';

export type CorporateReadonlyTargetConfigProvider = () => CorporateReadonlyTargetConfig;

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function requireCorporateReadonlyTargetAuthentication(
  getConfig: CorporateReadonlyTargetConfigProvider = getCorporateReadonlyTargetConfig,
): RequestHandler {
  return (req, res, next) => {
    const config = getConfig();
    if (!config.enabled || !isValidCorporateReadonlyTargetToken(config.token)) {
      res.status(503).json({
        status: 503,
        code: 'CORPORATE_READONLY_TARGET_UNAVAILABLE',
        message: 'Corporate read-only target is unavailable.',
        requestId: req.requestId,
      });
      return;
    }

    const expected = digest(`Bearer ${config.token}`);
    const actual = digest(req.get('authorization') ?? '');
    if (!timingSafeEqual(actual, expected)) {
      res.status(401).json({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Corporate read-only authentication failed.',
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}
