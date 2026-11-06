import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { usersController } from './users.controller';
import { userCreateSchema, usersQuerySchema, userUpdateSchema } from './users.schema';

export function createUsersRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('users.read'), validateQuery(usersQuerySchema), (req, res, next) => {
    void usersController.list(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('users.read'), validateParams(idParamsSchema), (req, res, next) => {
    void usersController.get(req, res).catch(next);
  });
  router.post(
    '/',
    requireAuth,
    requirePermission('users.manage'),
    validateBody(userCreateSchema),
    (req, res, next) => {
      void usersController.create(req, res).catch(next);
    },
  );
  router.patch(
    '/:id',
    requireAuth,
    requirePermission('users.manage'),
    validateParams(idParamsSchema),
    validateBody(userUpdateSchema),
    (req, res, next) => {
      void usersController.update(req, res).catch(next);
    },
  );

  router.delete(
    '/:id',
    requireAuth,
    requirePermission('users.manage'),
    validateParams(idParamsSchema),
    (req, res, next) => { void usersController.remove(req, res).catch(next); },
  );

  return router;
}
