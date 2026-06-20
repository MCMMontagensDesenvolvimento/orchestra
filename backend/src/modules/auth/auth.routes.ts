import { Router } from 'express';
import { authRateLimiter } from '../../app/middlewares';
import { requireAuth } from '../../shared/middleware/auth.middleware';
import { validateBody } from '../../shared/validation/validate';
import { authController } from './auth.controller';
import { devLoginSchema } from './auth.schema';

export function createAuthRouter() {
  const router = Router();

  router.get('/sso/config', authRateLimiter, (req, res, next) => {
    void authController.ssoConfig(req, res).catch(next);
  });
  router.get('/microsoft/start', authRateLimiter, (req, res, next) => {
    void authController.microsoftStart(req, res).catch(next);
  });
  router.get('/microsoft/callback', authRateLimiter, (req, res, next) => {
    void authController.microsoftCallback(req, res).catch(next);
  });
  router.get('/microsoft/logout', authRateLimiter, (req, res, next) => {
    void authController.microsoftLogout(req, res).catch(next);
  });
  router.post('/dev-login', authRateLimiter, validateBody(devLoginSchema), (req, res, next) => {
    void authController.devLogin(req, res).catch(next);
  });
  router.post('/logout', requireAuth, (req, res, next) => {
    void authController.logout(req, res).catch(next);
  });
  router.get('/me', requireAuth, (req, res, next) => {
    void authController.me(req, res).catch(next);
  });

  return router;
}
