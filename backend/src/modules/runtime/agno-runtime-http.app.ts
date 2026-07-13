import { timingSafeEqual } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { normalizeAgnoRuntimeHttpSecurityKey } from '../../config/agno-runtime-http-security';
import {
  agnoRuntimeHttpCapabilities,
  agnoRuntimeHttpHealth,
  executeAgnoRuntimeHttpContract,
  invalidJsonResult,
  unknownRuntimeErrorResult,
  unsupportedMediaTypeResult,
} from './agno-runtime-http.service';

const jsonOnly: RequestHandler = (req, res, next) => {
  if (!req.is('application/json')) {
    const result = unsupportedMediaTypeResult();
    res.status(result.httpStatus).json(result.body);
    return;
  }
  next();
};

interface AgnoRuntimeHttpAppOptions {
  securityKey?: string | null;
  requireSecurityKey?: boolean;
}

export function createAgnoRuntimeHttpApp(options: AgnoRuntimeHttpAppOptions = {}) {
  const app = express();
  const securityKey = options.securityKey === null
    ? undefined
    : normalizeAgnoRuntimeHttpSecurityKey(options.securityKey ?? process.env.AGNO_RUNTIME_HTTP_SECURITY_KEY);
  const securityRequired = options.requireSecurityKey
    ?? process.env.AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY?.trim().toLowerCase() === 'true';
  if (securityRequired && !securityKey) {
    throw new Error('Agno runtime HTTP authentication is required but not configured.');
  }
  const authenticate = requireRuntimeAuthentication(securityKey);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb', type: 'application/json' }));

  app.get('/health', authenticate, (_req, res, next) => {
    try {
      res.status(200).json(agnoRuntimeHttpHealth());
    } catch (error) {
      next(error);
    }
  });

  app.get('/capabilities', authenticate, (_req, res, next) => {
    try {
      res.status(200).json(agnoRuntimeHttpCapabilities());
    } catch (error) {
      next(error);
    }
  });

  app.post('/execute', authenticate, jsonOnly, (req, res, next) => {
    try {
      const result = executeAgnoRuntimeHttpContract(req.body as unknown);
      res.status(result.httpStatus).json(result.body);
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    });
  });

  app.use(agnoRuntimeHttpErrorHandler);

  return app;
}

function requireRuntimeAuthentication(securityKey: string | undefined): RequestHandler {
  if (!securityKey) return (_req, _res, next) => next();
  const expected = Buffer.from(`Bearer ${securityKey}`, 'utf8');

  return (req, res, next) => {
    const actual = Buffer.from(req.get('authorization') ?? '', 'utf8');
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      next();
      return;
    }
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Runtime authentication failed.',
      },
    });
  };
}

const agnoRuntimeHttpErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  void next;

  if (isJsonParseError(error)) {
    const result = invalidJsonResult(400);
    res.status(result.httpStatus).json(result.body);
    return;
  }

  if (isPayloadTooLargeError(error)) {
    const result = invalidJsonResult(413);
    res.status(result.httpStatus).json(result.body);
    return;
  }

  const result = unknownRuntimeErrorResult();
  res.status(result.httpStatus).json(result.body);
};

function isJsonParseError(error: unknown) {
  return isErrorWithType(error) && error.type === 'entity.parse.failed';
}

function isPayloadTooLargeError(error: unknown) {
  return isErrorWithType(error) && error.type === 'entity.too.large';
}

function isErrorWithType(error: unknown): error is { type: string } {
  return error !== null
    && typeof error === 'object'
    && 'type' in error
    && typeof error.type === 'string';
}
