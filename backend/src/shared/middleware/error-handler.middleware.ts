import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../errors/app-error';

interface BodyParserError {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

function isMalformedJsonBodyParserError(error: unknown): error is BodyParserError {
  if (error === null || typeof error !== 'object') return false;
  const candidate = error as BodyParserError;
  return candidate.type === 'entity.parse.failed'
    && (candidate.status === 400 || candidate.statusCode === 400);
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  void _next;

  if (isMalformedJsonBodyParserError(error)) {
    logger.warn({
      error: {
        type: 'entity.parse.failed',
        status: 400,
      },
      requestId: req.requestId,
    }, 'Invalid JSON request');
    return res.status(400).json({
      status: 400,
      code: 'INVALID_JSON',
      message: 'JSON inválido.',
      requestId: req.requestId,
    });
  }

  if (error instanceof ZodError) {
    return res.status(422).json({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Existem campos invalidos.',
      fieldErrors: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      requestId: req.requestId,
    });
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error, requestId: req.requestId }, error.message);
    }
    return res.status(error.status).json({
      status: error.status,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
      requestId: req.requestId,
    });
  }

  logger.error({ err: error, requestId: req.requestId }, 'Unhandled error');
  return res.status(500).json({
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Erro inesperado no servidor.',
    requestId: req.requestId,
    ...(env.NODE_ENV === 'production' ? {} : { details: error instanceof Error ? error.message : String(error) }),
  });
}
