import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { auditController } from './audit.controller';

export function createAuditRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('audit.read'), (req, res, next) => {
    void auditController.list(req, res).catch(next);
  });

  return router;
}
