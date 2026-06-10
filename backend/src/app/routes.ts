import express from 'express';
import { createHealthRouter, type HealthDependencies } from '../modules/health/health.routes';
import { createAuthRouter } from '../modules/auth/auth.routes';
import { createTenantsRouter } from '../modules/tenants/tenants.routes';
import { createWorkspacesRouter } from '../modules/workspaces/workspaces.routes';
import { createUsersRouter } from '../modules/users/users.routes';
import { createRolesRouter } from '../modules/roles/roles.routes';
import { createPermissionsRouter } from '../modules/permissions/permissions.routes';
import { createAssistantsRouter } from '../modules/assistants/assistants.routes';
import { createAuditRouter } from '../modules/audit/audit.routes';

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
  api.use('/audit-logs', createAuditRouter());

  app.use('/api/v1', api);
}
