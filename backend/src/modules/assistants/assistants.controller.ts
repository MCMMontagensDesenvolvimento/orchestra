import type { Request, Response } from 'express';
import { assistantsService } from './assistants.service';

export const assistantsController = {
  async list(req: Request, res: Response) {
    const result = await assistantsService.list(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await assistantsService.get(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async create(req: Request, res: Response) {
    const data = await assistantsService.create(req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async update(req: Request, res: Response) {
    const data = await assistantsService.update(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async archive(req: Request, res: Response) {
    const data = await assistantsService.archive(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listVersions(req: Request, res: Response) {
    const data = await assistantsService.listVersions(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createVersion(req: Request, res: Response) {
    const data = await assistantsService.createVersion(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async getVersion(req: Request, res: Response) {
    const data = await assistantsService.getVersion(req.params.id, req.params.versionId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async publish(req: Request, res: Response) {
    const data = await assistantsService.publish(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async restore(req: Request, res: Response) {
    const data = await assistantsService.restore(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listApprovals(req: Request, res: Response) {
    const data = await assistantsService.listApprovals(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async getApproval(req: Request, res: Response) {
    const data = await assistantsService.getApproval(req.params.id, req.params.approvalId, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createApproval(req: Request, res: Response) {
    const data = await assistantsService.createApproval(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async approveApproval(req: Request, res: Response) {
    const data = await assistantsService.approveApproval(req.params.id, req.params.approvalId, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async rejectApproval(req: Request, res: Response) {
    const data = await assistantsService.rejectApproval(req.params.id, req.params.approvalId, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async cancelApproval(req: Request, res: Response) {
    const data = await assistantsService.cancelApproval(req.params.id, req.params.approvalId, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async getExecutionPolicy(req: Request, res: Response) {
    const data = await assistantsService.getExecutionPolicy(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async updateExecutionPolicy(req: Request, res: Response) {
    const data = await assistantsService.updateExecutionPolicy(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async executionPrecheck(req: Request, res: Response) {
    const data = await assistantsService.executionPrecheck(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json(data);
  },

  async rollback(req: Request, res: Response) {
    const data = await assistantsService.rollback(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listPublications(req: Request, res: Response) {
    const data = await assistantsService.listPublications(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async getActivePublication(req: Request, res: Response) {
    const data = await assistantsService.getActivePublication(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listFeedback(req: Request, res: Response) {
    const data = await assistantsService.listFeedback(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createFeedback(req: Request, res: Response) {
    const data = await assistantsService.createFeedback(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async listTestResults(req: Request, res: Response) {
    const data = await assistantsService.listTestResults(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createTestResult(req: Request, res: Response) {
    const data = await assistantsService.createTestResult(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async unpublish(req: Request, res: Response) {
    const data = await assistantsService.unpublish(req.params.id, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listShares(req: Request, res: Response) {
    const data = await assistantsService.listShares(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createShare(req: Request, res: Response) {
    const data = await assistantsService.createShare(req.params.id, req.body, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async deleteShare(req: Request, res: Response) {
    await assistantsService.deleteShare(req.params.id, req.params.shareId, req.user!, {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(204).send();
  },
};
