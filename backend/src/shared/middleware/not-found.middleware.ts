import type { Request, Response } from 'express';

export function notFoundMiddleware(req: Request, res: Response) {
  return res.status(404).json({
    status: 404,
    code: 'NOT_FOUND',
    message: 'Rota nao encontrada.',
    requestId: req.requestId,
  });
}
