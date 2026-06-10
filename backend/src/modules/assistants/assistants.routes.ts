import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { assistantsController } from './assistants.controller';
import {
  assistantCreateSchema,
  assistantFeedbackCreateSchema,
  assistantPublishSchema,
  assistantRollbackSchema,
  assistantShareCreateSchema,
  assistantShareParamsSchema,
  assistantTestResultCreateSchema,
  assistantsQuerySchema,
  assistantUpdateSchema,
  assistantVersionCreateSchema,
  assistantVersionParamsSchema,
} from './assistants.schema';

export function createAssistantsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('assistants.read'), validateQuery(assistantsQuerySchema), (req, res, next) => {
    void assistantsController.list(req, res).catch(next);
  });
  router.get('/:id/versions', requireAuth, requirePermission('assistants.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.listVersions(req, res).catch(next);
  });
  router.post(
    '/:id/versions',
    requireAuth,
    requirePermission('assistants.update'),
    validateParams(idParamsSchema),
    validateBody(assistantVersionCreateSchema),
    (req, res, next) => {
      void assistantsController.createVersion(req, res).catch(next);
    },
  );
  router.get(
    '/:id/versions/:versionId',
    requireAuth,
    requirePermission('assistants.read'),
    validateParams(assistantVersionParamsSchema),
    (req, res, next) => {
      void assistantsController.getVersion(req, res).catch(next);
    },
  );
  router.post('/:id/archive', requireAuth, requirePermission('assistants.archive'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.archive(req, res).catch(next);
  });
  router.post('/:id/restore', requireAuth, requirePermission('assistants.restore'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.restore(req, res).catch(next);
  });
  router.post(
    '/:id/publish',
    requireAuth,
    requirePermission('assistants.publish'),
    validateParams(idParamsSchema),
    validateBody(assistantPublishSchema),
    (req, res, next) => {
      void assistantsController.publish(req, res).catch(next);
    },
  );
  router.post('/:id/unpublish', requireAuth, requirePermission('assistants.unpublish'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.unpublish(req, res).catch(next);
  });
  router.post(
    '/:id/rollback',
    requireAuth,
    requirePermission('assistants.rollback'),
    validateParams(idParamsSchema),
    validateBody(assistantRollbackSchema),
    (req, res, next) => {
      void assistantsController.rollback(req, res).catch(next);
    },
  );
  router.get('/:id/publications/active', requireAuth, requirePermission('assistants.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.getActivePublication(req, res).catch(next);
  });
  router.get('/:id/publications', requireAuth, requirePermission('assistants.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.listPublications(req, res).catch(next);
  });
  router.get('/:id/feedback', requireAuth, requirePermission('assistants.feedback.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.listFeedback(req, res).catch(next);
  });
  router.post(
    '/:id/feedback',
    requireAuth,
    requirePermission('assistants.feedback.create'),
    validateParams(idParamsSchema),
    validateBody(assistantFeedbackCreateSchema),
    (req, res, next) => {
      void assistantsController.createFeedback(req, res).catch(next);
    },
  );
  router.get('/:id/test-results', requireAuth, requirePermission('assistants.testResults.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.listTestResults(req, res).catch(next);
  });
  router.post(
    '/:id/test-results',
    requireAuth,
    requirePermission('assistants.testResults.create'),
    validateParams(idParamsSchema),
    validateBody(assistantTestResultCreateSchema),
    (req, res, next) => {
      void assistantsController.createTestResult(req, res).catch(next);
    },
  );
  router.get('/:id/shares', requireAuth, requirePermission('assistants.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.listShares(req, res).catch(next);
  });
  router.post(
    '/:id/shares',
    requireAuth,
    requirePermission('assistants.share'),
    validateParams(idParamsSchema),
    validateBody(assistantShareCreateSchema),
    (req, res, next) => {
      void assistantsController.createShare(req, res).catch(next);
    },
  );
  router.delete(
    '/:id/shares/:shareId',
    requireAuth,
    requirePermission('assistants.share'),
    validateParams(assistantShareParamsSchema),
    (req, res, next) => {
      void assistantsController.deleteShare(req, res).catch(next);
    },
  );
  router.get('/:id', requireAuth, requirePermission('assistants.read'), validateParams(idParamsSchema), (req, res, next) => {
    void assistantsController.get(req, res).catch(next);
  });
  router.post('/', requireAuth, requirePermission('assistants.create'), validateBody(assistantCreateSchema), (req, res, next) => {
    void assistantsController.create(req, res).catch(next);
  });
  router.patch('/:id', requireAuth, requirePermission('assistants.update'), validateParams(idParamsSchema), validateBody(assistantUpdateSchema), (req, res, next) => {
    void assistantsController.update(req, res).catch(next);
  });

  return router;
}
