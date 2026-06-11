import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { mcpController } from './mcp.controller';
import {
  assistantMcpBindingCreateSchema,
  assistantMcpBindingParamsSchema,
  assistantMcpBindingUpdateSchema,
  mcpPromptCreateSchema,
  mcpResourceCreateSchema,
  mcpServerChildParamsSchema,
  mcpServerCreateSchema,
  mcpServersQuerySchema,
  mcpServerUpdateSchema,
  mcpToolCreateSchema,
  mcpToolParamsSchema,
  mcpToolUpdateSchema,
} from './mcp.schema';

export function createMcpRouter() {
  const router = Router();

  router.get('/servers', requireAuth, requirePermission('mcp.read'), validateQuery(mcpServersQuerySchema), (req, res, next) => {
    void mcpController.listServers(req, res).catch(next);
  });
  router.post('/servers', requireAuth, requirePermission('mcp.create'), validateBody(mcpServerCreateSchema), (req, res, next) => {
    void mcpController.createServer(req, res).catch(next);
  });
  router.get('/servers/:id', requireAuth, requirePermission('mcp.read'), validateParams(idParamsSchema), (req, res, next) => {
    void mcpController.getServer(req, res).catch(next);
  });
  router.patch(
    '/servers/:id',
    requireAuth,
    requirePermission('mcp.update'),
    validateParams(idParamsSchema),
    validateBody(mcpServerUpdateSchema),
    (req, res, next) => {
      void mcpController.updateServer(req, res).catch(next);
    },
  );
  router.post('/servers/:id/archive', requireAuth, requirePermission('mcp.archive'), validateParams(idParamsSchema), (req, res, next) => {
    void mcpController.archiveServer(req, res).catch(next);
  });
  router.post('/servers/:id/restore', requireAuth, requirePermission('mcp.restore'), validateParams(idParamsSchema), (req, res, next) => {
    void mcpController.restoreServer(req, res).catch(next);
  });

  router.get('/servers/:id/tools', requireAuth, requirePermission('mcp.tools.read'), validateParams(mcpServerChildParamsSchema), (req, res, next) => {
    void mcpController.listTools(req, res).catch(next);
  });
  router.post(
    '/servers/:id/tools',
    requireAuth,
    requirePermission('mcp.tools.manage'),
    validateParams(mcpServerChildParamsSchema),
    validateBody(mcpToolCreateSchema),
    (req, res, next) => {
      void mcpController.createTool(req, res).catch(next);
    },
  );
  router.patch(
    '/tools/:toolId',
    requireAuth,
    requirePermission('mcp.tools.manage'),
    validateParams(mcpToolParamsSchema),
    validateBody(mcpToolUpdateSchema),
    (req, res, next) => {
      void mcpController.updateTool(req, res).catch(next);
    },
  );
  router.post('/tools/:toolId/archive', requireAuth, requirePermission('mcp.tools.manage'), validateParams(mcpToolParamsSchema), (req, res, next) => {
    void mcpController.archiveTool(req, res).catch(next);
  });

  router.get('/servers/:id/resources', requireAuth, requirePermission('mcp.read'), validateParams(mcpServerChildParamsSchema), (req, res, next) => {
    void mcpController.listResources(req, res).catch(next);
  });
  router.post(
    '/servers/:id/resources',
    requireAuth,
    requirePermission('mcp.update'),
    validateParams(mcpServerChildParamsSchema),
    validateBody(mcpResourceCreateSchema),
    (req, res, next) => {
      void mcpController.createResource(req, res).catch(next);
    },
  );
  router.get('/servers/:id/prompts', requireAuth, requirePermission('mcp.read'), validateParams(mcpServerChildParamsSchema), (req, res, next) => {
    void mcpController.listPrompts(req, res).catch(next);
  });
  router.post(
    '/servers/:id/prompts',
    requireAuth,
    requirePermission('mcp.update'),
    validateParams(mcpServerChildParamsSchema),
    validateBody(mcpPromptCreateSchema),
    (req, res, next) => {
      void mcpController.createPrompt(req, res).catch(next);
    },
  );

  return router;
}

export function registerAssistantMcpBindingRoutes(router: Router) {
  router.get('/:id/mcp-bindings', requireAuth, requirePermission('mcp.read'), validateParams(idParamsSchema), (req, res, next) => {
    void mcpController.listBindings(req, res).catch(next);
  });
  router.post(
    '/:id/mcp-bindings',
    requireAuth,
    requirePermission('mcp.bind'),
    validateParams(idParamsSchema),
    validateBody(assistantMcpBindingCreateSchema),
    (req, res, next) => {
      void mcpController.createBinding(req, res).catch(next);
    },
  );
  router.patch(
    '/:id/mcp-bindings/:bindingId',
    requireAuth,
    requirePermission('mcp.bind'),
    validateParams(assistantMcpBindingParamsSchema),
    validateBody(assistantMcpBindingUpdateSchema),
    (req, res, next) => {
      void mcpController.updateBinding(req, res).catch(next);
    },
  );
  router.delete(
    '/:id/mcp-bindings/:bindingId',
    requireAuth,
    requirePermission('mcp.bind'),
    validateParams(assistantMcpBindingParamsSchema),
    (req, res, next) => {
      void mcpController.removeBinding(req, res).catch(next);
    },
  );
}
