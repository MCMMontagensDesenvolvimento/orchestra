import type { Request, Response } from 'express';
import { mapLlmCapabilities, mapLlmConfig, mapLlmGenerationResult, mapLlmHealth, mapLlmProvider } from './llm.mapper';
import { llmProviderParamSchema, llmTestGenerationSchema } from './llm.schema';
import { llmService } from './llm.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const llmController = {
  async providers(req: Request, res: Response) {
    const data = await llmService.providers(req.user!, requestContext(req));
    return res.status(200).json({ data: data.map(mapLlmProvider), requestId: req.requestId });
  },

  async provider(req: Request, res: Response) {
    const params = llmProviderParamSchema.parse(req.params);
    const data = await llmService.provider(params.provider, req.user!, requestContext(req));
    return res.status(200).json({ data: mapLlmProvider(data), requestId: req.requestId });
  },

  async health(req: Request, res: Response) {
    const params = llmProviderParamSchema.parse(req.params);
    const data = await llmService.health(params.provider, req.user!, requestContext(req));
    return res.status(200).json({ data: mapLlmHealth(data), requestId: req.requestId });
  },

  async capabilities(req: Request, res: Response) {
    const params = llmProviderParamSchema.parse(req.params);
    const data = await llmService.capabilities(params.provider, req.user!, requestContext(req));
    return res.status(200).json({ data: mapLlmCapabilities(data), requestId: req.requestId });
  },

  async config(req: Request, res: Response) {
    const data = llmService.config();
    return res.status(200).json({ data: mapLlmConfig(data), requestId: req.requestId });
  },

  async testGeneration(req: Request, res: Response) {
    const input = llmTestGenerationSchema.parse(req.body);
    const data = await llmService.testGeneration(input, req.user!, requestContext(req));
    return res.status(200).json({ data: mapLlmGenerationResult(data), requestId: req.requestId });
  },
};
