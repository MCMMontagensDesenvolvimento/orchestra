import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { usersController } from './users.controller';

export function createUsersRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('users.read'), (req, res, next) => {
    void usersController.list(req, res).catch(next);
  });

  return router;
}
