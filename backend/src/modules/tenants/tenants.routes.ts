import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { idParamsSchema } from '../../shared/validation/pagination';
import { tenantsController } from './tenants.controller';
import { tenantsQuerySchema, tenantUpdateSchema } from './tenants.schema';

export function createTenantsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('tenants.read'), validateQuery(tenantsQuerySchema), (req, res, next) => {
    void tenantsController.list(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('tenants.read'), validateParams(idParamsSchema), (req, res, next) => {
    void tenantsController.get(req, res).catch(next);
  });
  router.patch(
    '/:id',
    requireAuth,
    requirePermission('tenants.manage'),
    validateParams(idParamsSchema),
    validateBody(tenantUpdateSchema),
    (req, res, next) => {
      void tenantsController.update(req, res).catch(next);
    },
  );

  return router;
}
