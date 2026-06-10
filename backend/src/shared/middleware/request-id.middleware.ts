import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerRequestId = req.header('x-request-id');
  req.requestId = headerRequestId && headerRequestId.trim() !== ''
    ? headerRequestId
    : `req_${crypto.randomUUID()}`;
  res.setHeader('x-request-id', req.requestId);
  next();
}
