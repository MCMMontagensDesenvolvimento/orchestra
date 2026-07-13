import type { Request, Response } from 'express';
import { runtimeToolGatewayService } from './runtime.tool-gateway.service';

export const runtimeToolGatewayController = {
  async execute(req: Request, res: Response) {
    const data = await runtimeToolGatewayService.execute(req.body, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
