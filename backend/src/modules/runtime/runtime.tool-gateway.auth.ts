import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getRuntimeToolGatewayConfig } from './runtime.tool-gateway.config';

export const requireAgnoToolGatewayAuthentication: RequestHandler = (req, res, next) => {
  const config = getRuntimeToolGatewayConfig();
  const securityKey = config.securityKey;
  const expected = securityKey ? Buffer.from(`Bearer ${securityKey}`, 'utf8') : null;
  const actual = Buffer.from(req.get('authorization') ?? '', 'utf8');

  if (
    config.securityRequired
    && expected
    && actual.length === expected.length
    && timingSafeEqual(actual, expected)
  ) {
    next();
    return;
  }

  res.status(401).json({
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'Runtime authentication failed.',
    requestId: req.requestId,
  });
};
