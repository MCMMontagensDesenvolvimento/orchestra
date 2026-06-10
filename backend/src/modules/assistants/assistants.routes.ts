import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateBody } from '../../shared/validation/validate';
import { assistantsController } from './assistants.controller';
import { assistantCreateSchema, assistantUpdateSchema } from './assistants.schema';

export function createAssistantsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('assistants.read'), (req, res, next) => {
    void assistantsController.list(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('assistants.read'), (req, res, next) => {
    void assistantsController.get(req, res).catch(next);
  });
  router.post('/', requireAuth, requirePermission('assistants.create'), validateBody(assistantCreateSchema), (req, res, next) => {
    void assistantsController.create(req, res).catch(next);
  });
  router.patch('/:id', requireAuth, requirePermission('assistants.update'), validateBody(assistantUpdateSchema), (req, res, next) => {
    void assistantsController.update(req, res).catch(next);
  });

  return router;
}
