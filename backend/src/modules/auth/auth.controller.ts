import type { Request, Response } from 'express';
import { clearSessionCookie, setSessionCookie } from '../../shared/security/session';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { recordAuditEvent } from '../audit/audit.service';
import { authService } from './auth.service';
import {
  clearMicrosoftSsoTransactionCookie,
  readMicrosoftSsoTransactionCookie,
  setMicrosoftSsoTransactionCookie,
} from './microsoft-sso.state';
import {
  MicrosoftSsoFlowError,
  microsoftSsoService,
} from './microsoft-sso.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

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
  async ssoConfig(req: Request, res: Response) {
    return res.status(200).json({
      data: authService.ssoConfig(),
      requestId: req.requestId,
    });
  },

  async microsoftStart(req: Request, res: Response) {
    const result = await microsoftSsoService.start(requestContext(req));
    setMicrosoftSsoTransactionCookie(res, result.transactionToken);
    return res.redirect(302, result.authorizationUrl);
  },

  async microsoftCallback(req: Request, res: Response) {
    const transactionToken = readMicrosoftSsoTransactionCookie(req);
    clearMicrosoftSsoTransactionCookie(res);

    try {
      const result = await microsoftSsoService.callback(
        {
          query: req.query,
          transactionToken,
        },
        requestContext(req),
      );
      setSessionCookie(res, result.token);
      return res.redirect(302, result.redirectUrl);
    } catch (error) {
      const reason = error instanceof MicrosoftSsoFlowError
        ? error.reason
        : 'internal_error';
      return res.redirect(302, microsoftSsoService.errorRedirectUrl(reason));
    }
  },

  async microsoftLogout(_req: Request, res: Response) {
    clearSessionCookie(res);
    return res.redirect(302, microsoftSsoService.logoutRedirectUrl());
  },

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
