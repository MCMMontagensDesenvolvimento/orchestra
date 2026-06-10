import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { hasPermission, hasWorkspaceAccess } from '../security/rbac';
import { verifySession } from '../security/session';
import { recordAuditEvent } from '../../modules/audit/audit.service';

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) {
    return next();
  }

  try {
    const payload = verifySession(token);
    req.user = payload.user;
  } catch {
    // Invalid cookies should behave like no session for optional auth.
  }

  return next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  optionalAuth(req, _res, () => undefined);
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Sessao ausente ou invalida.'));
  }
  return next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Sessao ausente ou invalida.'));
    }
    if (!hasPermission(req.user, permission)) {
      void recordAuditEvent({
        tenantId: req.user.tenant.id,
        actorUserId: req.user.id,
        action: 'permission_denied',
        entity: 'permission',
        entityId: permission,
        metadata: {
          permission,
          method: req.method,
          path: req.originalUrl,
        },
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }).catch(() => undefined);
      return next(new AppError(403, 'FORBIDDEN', 'Permissao insuficiente.'));
    }
    return next();
  };
}

export function requireWorkspaceAccess(workspaceIdResolver: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Sessao ausente ou invalida.'));
    }
    const workspaceId = workspaceIdResolver(req);
    if (!workspaceId || !hasWorkspaceAccess(req.user, workspaceId)) {
      return next(new AppError(403, 'FORBIDDEN', 'Workspace fora do escopo do usuario.'));
    }
    return next();
  };
}
