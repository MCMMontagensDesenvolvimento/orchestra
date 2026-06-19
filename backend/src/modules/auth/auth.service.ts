import { env } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';
import { signSession } from '../../shared/security/session';
import { recordAuditEvent } from '../audit/audit.service';
import { mapUserForAuth } from './auth.mapper';
import { authRepository } from './auth.repository';
import type { DevLoginInput } from './auth.schema';
import { getMicrosoftSsoPublicConfig } from './microsoft-sso.config';

export const authService = {
  ssoConfig() {
    return getMicrosoftSsoPublicConfig();
  },

  async devLogin(input: DevLoginInput, context: { requestId: string; ipAddress?: string; userAgent?: string }) {
    if (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') {
      throw new AppError(403, 'DEV_LOGIN_DISABLED', 'Dev login nao esta disponivel em producao.');
    }

    const user = await authRepository.findUserForLogin(input.email);
    if (!user) {
      throw new AppError(404, 'DEV_USER_NOT_FOUND', 'Usuario de desenvolvimento nao encontrado. Execute o seed.');
    }

    await authRepository.updateLastLogin(user.id);
    const authUser = mapUserForAuth(user);
    const token = signSession({
      sub: authUser.id,
      user: authUser,
    });

    await recordAuditEvent({
      tenantId: authUser.tenant.id,
      actorUserId: authUser.id,
      action: 'dev_login',
      entity: 'user',
      entityId: authUser.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { token, user: authUser };
  },
};
