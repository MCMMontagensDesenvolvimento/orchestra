import type { Request, Response } from 'express';
import { chatConversationsService } from './chat-conversations.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const chatConversationsController = {
  async listForAssistant(req: Request, res: Response) {
    const data = await chatConversationsService.listForAssistant(req.params.id, req.query as any, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createForAssistant(req: Request, res: Response) {
    const data = await chatConversationsService.createForAssistant(req.params.id, req.body, req.user!);
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async get(req: Request, res: Response) {
    const data = await chatConversationsService.get(req.params.conversationId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async sendMessage(req: Request, res: Response) {
    const data = await chatConversationsService.sendMessage(req.params.conversationId, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async archive(req: Request, res: Response) {
    const data = await chatConversationsService.archive(req.params.conversationId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
