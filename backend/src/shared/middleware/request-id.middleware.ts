import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

const corporateReadonlyBoundaryPath = '/v1/corporate-readonly';

export function isCorporateReadonlyBoundaryUrl(url: string | undefined) {
  const pathname = url?.split('?', 1)[0]?.toLowerCase();
  return pathname === corporateReadonlyBoundaryPath
    || pathname?.startsWith(`${corporateReadonlyBoundaryPath}/`) === true;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerRequestId = req.header('x-request-id');
  req.requestId = !isCorporateReadonlyBoundaryUrl(req.originalUrl)
    && headerRequestId
    && headerRequestId.trim() !== ''
    ? headerRequestId
    : `req_${crypto.randomUUID()}`;
  res.setHeader('x-request-id', req.requestId);
  next();
}
