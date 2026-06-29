import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { mcpController } from './mcp.controller';
import { mcpRemoteCatalogAdminController } from './remote/mcp-remote-catalog-admin.controller';
import {
  mcpRemoteCatalogApplyLedgersQuerySchema,
  mcpRemoteCatalogEntriesQuerySchema,
} from './remote/mcp-remote-catalog-admin.schema';
import {
  assistantMcpBindingCreateSchema,
  assistantMcpBindingParamsSchema,
  assistantMcpBindingUpdateSchema,
  mcpPromptCreateSchema,
  mcpResourceCreateSchema,
  mcpExecutionRequestSchema,
  mcpServerChildParamsSchema,
  mcpServerCreateSchema,
  mcpServersQuerySchema,
  mcpServerUpdateSchema,
  mcpToolCallParamsSchema,
  mcpToolCallsQuerySchema,
  mcpToolCreateSchema,
  mcpToolParamsSchema,
  mcpToolUpdateSchema,
} from './mcp.schema';

export function createMcpRouter() {
  const router = Router();

  router.get(
    '/remote-catalog/entries',
    requireAuth,
    requirePermission('mcp.manage'),
    validateQuery(mcpRemoteCatalogEntriesQuerySchema),
    (req, res, next) => {
      void mcpRemoteCatalogAdminController.listEntries(req, res).catch(next);
    },
  );
  router.get(
    '/remote-catalog/entries/:id',
    requireAuth,
    requirePermission('mcp.manage'),
    validateParams(idParamsSchema),
    (req, res, next) => {
      void mcpRemoteCatalogAdminController.getEntry(req, res).catch(next);
    },
  );
  router.get(
    '/remote-catalog/apply-ledgers',
    requireAuth,
    requirePermission('mcp.manage'),
    validateQuery(mcpRemoteCatalogApplyLedgersQuerySchema),
    (req, res, next) => {
      void mcpRemoteCatalogAdminController.listApplyLedgers(req, res).catch(next);
    },
  );
  router.get(
    '/remote-catalog/apply-ledgers/:id',
    requireAuth,
    requirePermission('mcp.manage'),
    validateParams(idParamsSchema),
    (req, res, next) => {
      void mcpRemoteCatalogAdminController.getApplyLedger(req, res).catch(next);
    },
  );

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

  router.get('/tool-calls', requireAuth, requirePermission('mcp.tools.read'), validateQuery(mcpToolCallsQuerySchema), (req, res, next) => {
    void mcpController.listToolCalls(req, res).catch(next);
  });
  router.get('/tool-calls/:toolCallId', requireAuth, requirePermission('mcp.tools.read'), validateParams(mcpToolCallParamsSchema), (req, res, next) => {
    void mcpController.getToolCall(req, res).catch(next);
  });
  router.get('/tool-calls/:toolCallId/events', requireAuth, requirePermission('mcp.tools.read'), validateParams(mcpToolCallParamsSchema), (req, res, next) => {
    void mcpController.listToolCallEvents(req, res).catch(next);
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
  router.post(
    '/:id/mcp/precheck',
    requireAuth,
    requirePermission('execution.precheck'),
    validateParams(idParamsSchema),
    validateBody(mcpExecutionRequestSchema),
    (req, res, next) => {
      void mcpController.precheckSandboxExecution(req, res).catch(next);
    },
  );
  router.post(
    '/:id/mcp/tool-calls',
    requireAuth,
    requirePermission('execution.run_sandbox'),
    validateParams(idParamsSchema),
    validateBody(mcpExecutionRequestSchema),
    (req, res, next) => {
      void mcpController.runSandboxToolCall(req, res).catch(next);
    },
  );
  router.get(
    '/:id/mcp/tool-calls',
    requireAuth,
    requirePermission('mcp.tools.read'),
    validateParams(idParamsSchema),
    validateQuery(mcpToolCallsQuerySchema),
    (req, res, next) => {
      void mcpController.listAssistantToolCalls(req, res).catch(next);
    },
  );

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
