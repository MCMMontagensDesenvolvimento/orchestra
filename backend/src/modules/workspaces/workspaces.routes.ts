import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { workspacesController } from './workspaces.controller';
import { workspaceCreateSchema, workspacesQuerySchema, workspaceUpdateSchema } from './workspaces.schema';

export function createWorkspacesRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('workspaces.read'), validateQuery(workspacesQuerySchema), (req, res, next) => {
    void workspacesController.list(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('workspaces.read'), validateParams(idParamsSchema), (req, res, next) => {
    void workspacesController.get(req, res).catch(next);
  });
  router.post(
    '/',
    requireAuth,
    requirePermission('workspaces.manage'),
    validateBody(workspaceCreateSchema),
    (req, res, next) => {
      void workspacesController.create(req, res).catch(next);
    },
  );
  router.patch(
    '/:id',
    requireAuth,
    requirePermission('workspaces.manage'),
    validateParams(idParamsSchema),
    validateBody(workspaceUpdateSchema),
    (req, res, next) => {
      void workspacesController.update(req, res).catch(next);
    },
  );

  return router;
}
