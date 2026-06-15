import type { Request, Response } from 'express';
import { mapRuntimeCapabilities, mapRuntimeConfig, mapRuntimeHealth, mapRuntimeProvider } from './runtime.mapper';
import { runtimeService } from './runtime.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const runtimeController = {
  async providers(req: Request, res: Response) {
    const data = await runtimeService.providers(req.user!, requestContext(req));
    return res.status(200).json({ data: data.map(mapRuntimeProvider), requestId: req.requestId });
  },

  async capabilities(req: Request, res: Response) {
    const data = await runtimeService.capabilities(req.user!, requestContext(req));
    return res.status(200).json({ data: mapRuntimeCapabilities(data), requestId: req.requestId });
  },

  async health(req: Request, res: Response) {
    const data = await runtimeService.health(req.user!, requestContext(req));
    return res.status(200).json({ data: mapRuntimeHealth(data), requestId: req.requestId });
  },

  async config(req: Request, res: Response) {
    const data = runtimeService.config();
    return res.status(200).json({ data: mapRuntimeConfig(data), requestId: req.requestId });
  },
};
