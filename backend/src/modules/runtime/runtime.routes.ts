import { Router } from 'express';
import { runtimeToolGatewayRateLimiter } from '../../app/middlewares';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateBody } from '../../shared/validation/validate';
import { runtimeToolGatewayRequestSchema } from './runtime-contract.schema';
import { runtimeController } from './runtime.controller';
import { requireAgnoToolGatewayAuthentication } from './runtime.tool-gateway.auth';
import { runtimeToolGatewayController } from './runtime.tool-gateway.controller';

export function createRuntimeRouter() {
  const router = Router();

  router.post(
    '/agno/tool-calls',
    runtimeToolGatewayRateLimiter,
    requireAgnoToolGatewayAuthentication,
    validateBody(runtimeToolGatewayRequestSchema),
    (req, res, next) => {
      void runtimeToolGatewayController.execute(req, res).catch(next);
    },
  );

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
