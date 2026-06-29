import type { Request, Response } from 'express';
import { mcpRemoteCatalogAdminService } from './mcp-remote-catalog-admin.service';

export const mcpRemoteCatalogAdminController = {
  async listEntries(req: Request, res: Response) {
    const result = await mcpRemoteCatalogAdminService.listEntries(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getEntry(req: Request, res: Response) {
    const data = await mcpRemoteCatalogAdminService.getEntry(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listApplyLedgers(req: Request, res: Response) {
    const result = await mcpRemoteCatalogAdminService.listApplyLedgers(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getApplyLedger(req: Request, res: Response) {
    const data = await mcpRemoteCatalogAdminService.getApplyLedger(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
