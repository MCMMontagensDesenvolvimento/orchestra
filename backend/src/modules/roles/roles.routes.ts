import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { rolesController } from './roles.controller';
import { roleCreateSchema, rolePermissionParamsSchema, rolesQuerySchema, roleUpdateSchema } from './roles.schema';

export function createRolesRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('roles.read'), validateQuery(rolesQuerySchema), (req, res, next) => {
    void rolesController.list(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('roles.read'), validateParams(idParamsSchema), (req, res, next) => {
    void rolesController.get(req, res).catch(next);
  });
  router.post('/', requireAuth, requirePermission('roles.manage'), validateBody(roleCreateSchema), (req, res, next) => {
    void rolesController.create(req, res).catch(next);
  });
  router.patch(
    '/:id',
    requireAuth,
    requirePermission('roles.manage'),
    validateParams(idParamsSchema),
    validateBody(roleUpdateSchema),
    (req, res, next) => {
      void rolesController.update(req, res).catch(next);
    },
  );
  router.post(
    '/:id/permissions/:permissionId',
    requireAuth,
    requirePermission('roles.manage'),
    validateParams(rolePermissionParamsSchema),
    (req, res, next) => {
      void rolesController.addPermission(req, res).catch(next);
    },
  );
  router.delete(
    '/:id/permissions/:permissionId',
    requireAuth,
    requirePermission('roles.manage'),
    validateParams(rolePermissionParamsSchema),
    (req, res, next) => {
      void rolesController.removePermission(req, res).catch(next);
    },
  );

  return router;
}
