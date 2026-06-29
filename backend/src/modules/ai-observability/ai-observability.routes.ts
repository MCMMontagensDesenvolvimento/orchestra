import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { aiObservabilityAdminController } from './ai-observability-admin.controller';
import {
  aiUsageEventsQuerySchema,
  aiUsageLimitEvaluationSchema,
  aiUsageLimitPoliciesQuerySchema,
  aiUsageSummaryQuerySchema,
} from './ai-observability-admin.schema';

export function createAiObservabilityRouter() {
  const router = Router();
  const readPermission = requirePermission('audit.read');

  router.get(
    '/usage-events',
    requireAuth,
    readPermission,
    validateQuery(aiUsageEventsQuerySchema),
    (req, res, next) => {
      void aiObservabilityAdminController.listUsageEvents(req, res).catch(next);
    },
  );
  router.get(
    '/usage-events/:id',
    requireAuth,
    readPermission,
    validateParams(idParamsSchema),
    (req, res, next) => {
      void aiObservabilityAdminController.getUsageEvent(req, res).catch(next);
    },
  );
  router.get(
    '/usage-summary',
    requireAuth,
    readPermission,
    validateQuery(aiUsageSummaryQuerySchema),
    (req, res, next) => {
      void aiObservabilityAdminController.summarizeUsage(req, res).catch(next);
    },
  );
  router.get(
    '/limit-policies',
    requireAuth,
    readPermission,
    validateQuery(aiUsageLimitPoliciesQuerySchema),
    (req, res, next) => {
      void aiObservabilityAdminController.listLimitPolicies(req, res).catch(next);
    },
  );
  router.get(
    '/limit-policies/:id',
    requireAuth,
    readPermission,
    validateParams(idParamsSchema),
    (req, res, next) => {
      void aiObservabilityAdminController.getLimitPolicy(req, res).catch(next);
    },
  );
  router.post(
    '/limit-evaluation',
    requireAuth,
    readPermission,
    validateBody(aiUsageLimitEvaluationSchema),
    (req, res, next) => {
      void aiObservabilityAdminController.evaluateLimits(req, res).catch(next);
    },
  );

  return router;
}
