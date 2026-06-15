import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { runtimeController } from './runtime.controller';

export function createRuntimeRouter() {
  const router = Router();

  router.get('/providers', requireAuth, requirePermission('agent_runs.read'), (req, res, next) => {
    void runtimeController.providers(req, res).catch(next);
  });
  router.get('/capabilities', requireAuth, requirePermission('agent_runs.read'), (req, res, next) => {
    void runtimeController.capabilities(req, res).catch(next);
  });
  router.get('/health', requireAuth, requirePermission('agent_runs.read'), (req, res, next) => {
    void runtimeController.health(req, res).catch(next);
  });
  router.get('/config', requireAuth, requirePermission('agent_runs.read'), (req, res, next) => {
    void runtimeController.config(req, res).catch(next);
  });

  return router;
}
