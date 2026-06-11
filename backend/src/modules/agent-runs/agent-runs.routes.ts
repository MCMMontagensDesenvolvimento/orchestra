import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateParams, validateQuery } from '../../shared/validation/validate';
import { agentRunsController } from './agent-runs.controller';
import { agentRunParamsSchema, agentRunsQuerySchema } from './agent-runs.schema';

export function createAgentRunsRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('agent_runs.read'), validateQuery(agentRunsQuerySchema), (req, res, next) => {
    void agentRunsController.list(req, res).catch(next);
  });
  router.get('/:runId', requireAuth, requirePermission('agent_runs.read'), validateParams(agentRunParamsSchema), (req, res, next) => {
    void agentRunsController.get(req, res).catch(next);
  });
  router.get('/:runId/events', requireAuth, requirePermission('agent_runs.read'), validateParams(agentRunParamsSchema), (req, res, next) => {
    void agentRunsController.events(req, res).catch(next);
  });
  router.post('/:runId/cancel', requireAuth, requirePermission('agent_runs.cancel'), validateParams(agentRunParamsSchema), (req, res, next) => {
    void agentRunsController.cancel(req, res).catch(next);
  });

  return router;
}
