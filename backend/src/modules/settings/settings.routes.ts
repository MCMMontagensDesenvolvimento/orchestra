import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateQuery } from '../../shared/validation/validate';
import { settingsController } from './settings.controller';
import { settingsQuerySchema } from './settings.schema';

export function createSettingsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('settings.read'), validateQuery(settingsQuerySchema), (req, res, next) => {
    void settingsController.list(req, res).catch(next);
  });

  return router;
}
