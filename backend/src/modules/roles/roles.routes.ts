import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { rolesController } from './roles.controller';

export function createRolesRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('roles.read'), (req, res, next) => {
    void rolesController.list(req, res).catch(next);
  });

  return router;
}
