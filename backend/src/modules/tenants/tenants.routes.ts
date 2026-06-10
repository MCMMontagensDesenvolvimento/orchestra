import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { tenantsController } from './tenants.controller';

export function createTenantsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('tenants.read'), (req, res, next) => {
    void tenantsController.list(req, res).catch(next);
  });

  return router;
}
