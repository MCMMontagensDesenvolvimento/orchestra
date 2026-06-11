import express from 'express';
import { createHealthRouter, type HealthDependencies } from '../modules/health/health.routes';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createTenantsRouter } from '../modules/tenants/tenants.routes';
import { createWorkspacesRouter } from '../modules/workspaces/workspaces.routes';
import { createUsersRouter } from '../modules/users/users.routes';
import { createRolesRouter } from '../modules/roles/roles.routes';
import { createPermissionsRouter } from '../modules/permissions/permissions.routes';
import { createAssistantsRouter } from '../modules/assistants/assistants.routes';
import { createAgentRunsRouter } from '../modules/agent-runs/agent-runs.routes';
import { createAuditRouter } from '../modules/audit/audit.routes';
import { createSettingsRouter } from '../modules/settings/settings.routes';
import {
  createKnowledgeChunksRouter,
  createKnowledgeDataSourcesRouter,
  createKnowledgeDocumentsRouter,
  createKnowledgeIngestionJobsRouter,
  createKnowledgeRouter,
} from '../modules/knowledge/knowledge.routes';
import { createMcpRouter } from '../modules/mcp/mcp.routes';

export type AppDependencies = HealthDependencies;

export function registerRoutes(app: express.Express, dependencies: AppDependencies = {}) {
  app.use('/health', createHealthRouter(dependencies));

  const api = express.Router();
  api.use('/auth', createAuthRouter());
  api.use('/tenants', createTenantsRouter());
  api.use('/workspaces', createWorkspacesRouter());
  api.use('/users', createUsersRouter());
  api.use('/roles', createRolesRouter());
  api.use('/permissions', createPermissionsRouter());
  api.use('/assistants', createAssistantsRouter());
  api.use('/agent-runs', createAgentRunsRouter());
  api.use('/knowledge-bases', createKnowledgeRouter());
  api.use('/knowledge-documents', createKnowledgeDocumentsRouter());
  api.use('/knowledge-ingestion-jobs', createKnowledgeIngestionJobsRouter());
  api.use('/knowledge-chunks', createKnowledgeChunksRouter());
  api.use('/knowledge-data-sources', createKnowledgeDataSourcesRouter());
  api.use('/mcp', createMcpRouter());
  api.use('/audit-logs', createAuditRouter());
  api.use('/settings', createSettingsRouter());

  app.use('/api/v1', api);
}
