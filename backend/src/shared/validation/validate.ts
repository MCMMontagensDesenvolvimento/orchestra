import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };

export const validateQuery = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
  };
