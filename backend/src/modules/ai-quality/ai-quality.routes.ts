import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { aiQualityController } from './ai-quality.controller';
import {
  aiQualityCreateDeterministicRunSchema,
  aiQualityEvaluateTestCaseSchema,
  aiQualityEvaluationRunResultsQuerySchema,
  aiQualityEvaluationResultsQuerySchema,
  aiQualityEvaluationRunsQuerySchema,
  aiQualityTestCasesQuerySchema,
  aiQualityTestSetsQuerySchema,
} from './ai-quality.schema';

export function createAiQualityRouter() {
  const router = Router();
  const readPermission = requirePermission('audit.read');

  router.get(
    '/test-sets',
    requireAuth,
    readPermission,
    validateQuery(aiQualityTestSetsQuerySchema),
    (req, res, next) => {
      void aiQualityController.listTestSets(req, res).catch(next);
    },
  );

  router.get(
    '/test-sets/:id',
    requireAuth,
    readPermission,
    validateParams(idParamsSchema),
    (req, res, next) => {
      void aiQualityController.getTestSet(req, res).catch(next);
    },
  );

  router.get(
    '/test-cases',
    requireAuth,
    readPermission,
    validateQuery(aiQualityTestCasesQuerySchema),
    (req, res, next) => {
      void aiQualityController.listTestCases(req, res).catch(next);
    },
  );

  router.get(
    '/test-cases/:id',
    requireAuth,
    readPermission,
    validateParams(idParamsSchema),
    (req, res, next) => {
      void aiQualityController.getTestCase(req, res).catch(next);
    },
  );

  router.get(
    '/evaluation-runs',
    requireAuth,
    readPermission,
    validateQuery(aiQualityEvaluationRunsQuerySchema),
    (req, res, next) => {
      void aiQualityController.listEvaluationRuns(req, res).catch(next);
    },
  );

  router.post(
    '/evaluation-runs/deterministic',
    requireAuth,
    readPermission,
    validateBody(aiQualityCreateDeterministicRunSchema),
    (req, res, next) => {
      void aiQualityController.createDeterministicEvaluationRun(req, res).catch(next);
    },
  );

  router.get(
    '/evaluation-runs/:id/results',
    requireAuth,
    readPermission,
    validateParams(idParamsSchema),
    validateQuery(aiQualityEvaluationRunResultsQuerySchema),
    (req, res, next) => {
      void aiQualityController.getEvaluationRunResults(req, res).catch(next);
    },
  );

  router.get(
    '/evaluation-runs/:id',
    requireAuth,
    readPermission,
    validateParams(idParamsSchema),
    (req, res, next) => {
      void aiQualityController.getEvaluationRun(req, res).catch(next);
    },
  );

  router.get(
    '/evaluation-results',
    requireAuth,
    readPermission,
    validateQuery(aiQualityEvaluationResultsQuerySchema),
    (req, res, next) => {
      void aiQualityController.listEvaluationResults(req, res).catch(next);
    },
  );

  router.post(
    '/evaluate-test-case',
    requireAuth,
    readPermission,
    validateBody(aiQualityEvaluateTestCaseSchema),
    (req, res, next) => {
      void aiQualityController.evaluateTestCase(req, res).catch(next);
    },
  );

  return router;
}
