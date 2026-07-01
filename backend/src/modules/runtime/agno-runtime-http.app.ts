import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
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

export function createAgnoRuntimeHttpApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb', type: 'application/json' }));

  app.get('/health', (_req, res, next) => {
    try {
      res.status(200).json(agnoRuntimeHttpHealth());
    } catch (error) {
      next(error);
    }
  });

  app.get('/capabilities', (_req, res, next) => {
    try {
      res.status(200).json(agnoRuntimeHttpCapabilities());
    } catch (error) {
      next(error);
    }
  });

  app.post('/execute', jsonOnly, (req, res, next) => {
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
