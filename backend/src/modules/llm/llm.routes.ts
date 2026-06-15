import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { llmController } from './llm.controller';

export function createLlmRouter() {
  const router = Router();

  router.get('/providers', requireAuth, requirePermission('llm.providers.read'), (req, res, next) => {
    void llmController.providers(req, res).catch(next);
  });
  router.get('/providers/:provider', requireAuth, requirePermission('llm.providers.read'), (req, res, next) => {
    void llmController.provider(req, res).catch(next);
  });
  router.get('/providers/:provider/health', requireAuth, requirePermission('llm.providers.read'), (req, res, next) => {
    void llmController.health(req, res).catch(next);
  });
  router.get('/providers/:provider/capabilities', requireAuth, requirePermission('llm.providers.read'), (req, res, next) => {
    void llmController.capabilities(req, res).catch(next);
  });
  router.get('/config', requireAuth, requirePermission('llm.config.read'), (req, res, next) => {
    void llmController.config(req, res).catch(next);
  });
  router.post('/test-generation', requireAuth, requirePermission('llm.providers.test'), (req, res, next) => {
    void llmController.testGeneration(req, res).catch(next);
  });

  return router;
}
