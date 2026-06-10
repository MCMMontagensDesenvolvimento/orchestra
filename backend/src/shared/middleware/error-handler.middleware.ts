import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../errors/app-error';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  void _next;

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
