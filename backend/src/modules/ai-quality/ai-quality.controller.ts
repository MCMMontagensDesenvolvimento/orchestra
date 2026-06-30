import type { Request, Response } from 'express';
import { aiQualityService } from './ai-quality.service';

export const aiQualityController = {
  async listTestSets(req: Request, res: Response) {
    const result = await aiQualityService.listTestSets(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getTestSet(req: Request, res: Response) {
    const data = await aiQualityService.getTestSet(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listTestCases(req: Request, res: Response) {
    const result = await aiQualityService.listTestCases(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getTestCase(req: Request, res: Response) {
    const data = await aiQualityService.getTestCase(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listEvaluationRuns(req: Request, res: Response) {
    const result = await aiQualityService.listEvaluationRuns(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getEvaluationRun(req: Request, res: Response) {
    const data = await aiQualityService.getEvaluationRun(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async getEvaluationRunResults(req: Request, res: Response) {
    const result = await aiQualityService.getEvaluationRunResults(req.params.id, req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async listEvaluationResults(req: Request, res: Response) {
    const result = await aiQualityService.listEvaluationResults(req.user!, req.query as any);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async evaluateTestCase(req: Request, res: Response) {
    const data = await aiQualityService.evaluateTestCase(req.user!, req.body);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createDeterministicEvaluationRun(req: Request, res: Response) {
    const data = await aiQualityService.createDeterministicEvaluationRun(req.user!, req.body);
    return res.status(201).json({ data, requestId: req.requestId });
  },
};
