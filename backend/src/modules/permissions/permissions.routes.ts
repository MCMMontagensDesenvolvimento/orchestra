import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateParams, validateQuery } from '../../shared/validation/validate';
import { permissionsController } from './permissions.controller';
import { permissionsQuerySchema } from './permissions.schema';

export function createPermissionsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('permissions.read'), validateQuery(permissionsQuerySchema), (req, res, next) => {
    void permissionsController.list(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('permissions.read'), validateParams(idParamsSchema), (req, res, next) => {
    void permissionsController.get(req, res).catch(next);
  });

  return router;
}
