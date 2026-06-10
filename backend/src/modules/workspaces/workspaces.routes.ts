import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { workspacesController } from './workspaces.controller';

export function createWorkspacesRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('workspaces.read'), (req, res, next) => {
    void workspacesController.list(req, res).catch(next);
  });

  return router;
}
