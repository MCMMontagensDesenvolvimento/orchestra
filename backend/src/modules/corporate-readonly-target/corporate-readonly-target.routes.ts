import { Router, type RequestHandler } from 'express';
import { healthService } from '../health/health.service';
import { statusService, type StatusServiceDependencies } from '../status/status.service';
import {
  requireCorporateReadonlyTargetAuthentication,
  type CorporateReadonlyTargetConfigProvider,
} from './corporate-readonly-target.auth';

export interface CorporateReadonlyTargetDependencies extends StatusServiceDependencies {
  corporateReadonlyTargetConfig?: CorporateReadonlyTargetConfigProvider;
}

const requireEmptyRequest: RequestHandler = (req, res, next) => {
  const body = req.body as unknown;
  const hasBody = body !== undefined
    && (typeof body !== 'object' || body === null || Object.keys(body).length > 0);
  if (Object.keys(req.query).length > 0 || hasBody) {
    res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Corporate read-only request does not accept input.',
      requestId: req.requestId,
    });
    return;
  }
  next();
};

export function createCorporateReadonlyTargetRouter(
  dependencies: CorporateReadonlyTargetDependencies = {},
) {
  const router = Router();
  const authenticate = requireCorporateReadonlyTargetAuthentication(
    dependencies.corporateReadonlyTargetConfig,
  );

  router.get('/health', authenticate, requireEmptyRequest, async (req, res, next) => {
    try {
      const result = await healthService.check();
      return res.status(200).json({ ...result, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/status', authenticate, requireEmptyRequest, (_req, res) => {
    return res.status(200).json(statusService.read(dependencies));
  });

  router.get('/status/availability', authenticate, requireEmptyRequest, (_req, res) => {
    return res.status(200).json(statusService.readAvailability(dependencies));
  });

  return router;
}
