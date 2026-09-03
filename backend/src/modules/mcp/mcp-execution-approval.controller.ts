import type { Request, Response } from 'express';
import { mcpExecutionApprovalService } from './mcp-execution-approval.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const mcpExecutionApprovalController = {
  async list(req: Request, res: Response) {
    const result = await mcpExecutionApprovalService.list(
      req.params.id,
      req.query as never,
      req.user!,
      requestContext(req),
    );
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async create(req: Request, res: Response) {
    const data = await mcpExecutionApprovalService.create(
      req.params.id,
      req.body,
      req.user!,
      requestContext(req),
    );
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async approve(req: Request, res: Response) {
    const data = await mcpExecutionApprovalService.approve(
      req.params.id,
      req.params.approvalId,
      req.body,
      req.user!,
      requestContext(req),
    );
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async reject(req: Request, res: Response) {
    const data = await mcpExecutionApprovalService.reject(
      req.params.id,
      req.params.approvalId,
      req.body,
      req.user!,
      requestContext(req),
    );
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async cancel(req: Request, res: Response) {
    const data = await mcpExecutionApprovalService.cancel(
      req.params.id,
      req.params.approvalId,
      req.body,
      req.user!,
      requestContext(req),
    );
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
