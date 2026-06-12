import type { Request, Response } from 'express';
import { mcpService } from './mcp.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const mcpController = {
  async listServers(req: Request, res: Response) {
    const result = await mcpService.listServers(req.user!, req.query as any, requestContext(req));
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getServer(req: Request, res: Response) {
    const data = await mcpService.getServer(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createServer(req: Request, res: Response) {
    const data = await mcpService.createServer(req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async updateServer(req: Request, res: Response) {
    const data = await mcpService.updateServer(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async archiveServer(req: Request, res: Response) {
    const data = await mcpService.archiveServer(req.params.id, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async restoreServer(req: Request, res: Response) {
    const data = await mcpService.restoreServer(req.params.id, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listTools(req: Request, res: Response) {
    const data = await mcpService.listTools(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createTool(req: Request, res: Response) {
    const data = await mcpService.createTool(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async updateTool(req: Request, res: Response) {
    const data = await mcpService.updateTool(req.params.toolId, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async archiveTool(req: Request, res: Response) {
    const data = await mcpService.archiveTool(req.params.toolId, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listResources(req: Request, res: Response) {
    const data = await mcpService.listResources(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createResource(req: Request, res: Response) {
    const data = await mcpService.createResource(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async listPrompts(req: Request, res: Response) {
    const data = await mcpService.listPrompts(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createPrompt(req: Request, res: Response) {
    const data = await mcpService.createPrompt(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async listBindings(req: Request, res: Response) {
    const data = await mcpService.listBindings(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createBinding(req: Request, res: Response) {
    const data = await mcpService.createBinding(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async updateBinding(req: Request, res: Response) {
    const data = await mcpService.updateBinding(req.params.id, req.params.bindingId, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async removeBinding(req: Request, res: Response) {
    await mcpService.removeBinding(req.params.id, req.params.bindingId, req.user!, requestContext(req));
    return res.status(204).send();
  },

  async precheckSandboxExecution(req: Request, res: Response) {
    const data = await mcpService.precheckSandboxExecution(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async runSandboxToolCall(req: Request, res: Response) {
    const data = await mcpService.runSandboxToolCall(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async listAssistantToolCalls(req: Request, res: Response) {
    const result = await mcpService.listAssistantToolCalls(req.params.id, req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async listToolCalls(req: Request, res: Response) {
    const result = await mcpService.listToolCalls(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getToolCall(req: Request, res: Response) {
    const data = await mcpService.getToolCall(req.params.toolCallId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listToolCallEvents(req: Request, res: Response) {
    const data = await mcpService.listToolCallEvents(req.params.toolCallId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },
};
