import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { permissionsController } from './permissions.controller';

export function createPermissionsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('permissions.read'), (req, res, next) => {
    void permissionsController.list(req, res).catch(next);
  });

  return router;
}
