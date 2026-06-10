import type { Request, Response } from 'express';
import { clearSessionCookie, setSessionCookie } from '../../shared/security/session';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { recordAuditEvent } from '../audit/audit.service';
import { authService } from './auth.service';

function sessionResponse(user: AuthenticatedUser, requestId: string) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tenant: user.tenant,
    workspaces: user.workspaces,
    roles: user.roles,
    permissions: user.permissions,
    requestId,
  };
}

export const authController = {
  async devLogin(req: Request, res: Response) {
    const result = await authService.devLogin(req.body, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    setSessionCookie(res, result.token);
    return res.status(200).json(sessionResponse(result.user, req.requestId));
  },

  async logout(req: Request, res: Response) {
    if (req.user) {
      await recordAuditEvent({
        tenantId: req.user.tenant.id,
        actorUserId: req.user.id,
        action: 'logout',
        entity: 'user',
        entityId: req.user.id,
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    clearSessionCookie(res);
    return res.status(204).send();
  },

  async me(req: Request, res: Response) {
    return res.status(200).json(sessionResponse(req.user!, req.requestId));
  },
};
