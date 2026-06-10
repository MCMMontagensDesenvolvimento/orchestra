import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateQuery } from '../../shared/validation/validate';
import { auditController } from './audit.controller';
import { auditQuerySchema } from './audit.schema';

export function createAuditRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('audit.read'), validateQuery(auditQuerySchema), (req, res, next) => {
    void auditController.list(req, res).catch(next);
  });

  return router;
}
