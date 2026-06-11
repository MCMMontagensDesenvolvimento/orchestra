import type { Request, Response } from 'express';
import { knowledgeService } from './knowledge.service';

function requestContext(req: Request) {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export const knowledgeController = {
  async listKnowledgeBases(req: Request, res: Response) {
    const result = await knowledgeService.listKnowledgeBases(req.user!, req.query as any, requestContext(req));
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getKnowledgeBase(req: Request, res: Response) {
    const data = await knowledgeService.getKnowledgeBase(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createKnowledgeBase(req: Request, res: Response) {
    const data = await knowledgeService.createKnowledgeBase(req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async updateKnowledgeBase(req: Request, res: Response) {
    const data = await knowledgeService.updateKnowledgeBase(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async archiveKnowledgeBase(req: Request, res: Response) {
    const data = await knowledgeService.archiveKnowledgeBase(req.params.id, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async restoreKnowledgeBase(req: Request, res: Response) {
    const data = await knowledgeService.restoreKnowledgeBase(req.params.id, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listDocuments(req: Request, res: Response) {
    const data = await knowledgeService.listDocuments(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createDocument(req: Request, res: Response) {
    const data = await knowledgeService.createDocument(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async getDocument(req: Request, res: Response) {
    const data = await knowledgeService.getDocument(req.params.documentId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async updateDocument(req: Request, res: Response) {
    const data = await knowledgeService.updateDocument(req.params.documentId, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async archiveDocument(req: Request, res: Response) {
    const data = await knowledgeService.archiveDocument(req.params.documentId, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async requestIngestion(req: Request, res: Response) {
    const data = await knowledgeService.requestIngestion(req.params.documentId, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async listIngestionJobs(req: Request, res: Response) {
    const data = await knowledgeService.listIngestionJobs(req.params.documentId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async getIngestionJob(req: Request, res: Response) {
    const data = await knowledgeService.getIngestionJob(req.params.jobId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listDocumentChunks(req: Request, res: Response) {
    const result = await knowledgeService.listDocumentChunks(req.params.documentId, req.query as any, req.user!);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async listKnowledgeBaseChunks(req: Request, res: Response) {
    const result = await knowledgeService.listKnowledgeBaseChunks(req.params.id, req.query as any, req.user!);
    return res.status(200).json({ ...result, requestId: req.requestId });
  },

  async getChunk(req: Request, res: Response) {
    const data = await knowledgeService.getChunk(req.params.chunkId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listDocumentSourceReferences(req: Request, res: Response) {
    const data = await knowledgeService.listDocumentSourceReferences(req.params.documentId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listChunkSourceReferences(req: Request, res: Response) {
    const data = await knowledgeService.listChunkSourceReferences(req.params.chunkId, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async getRagReadiness(req: Request, res: Response) {
    const data = await knowledgeService.getRagReadiness(req.params.id, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async localSearch(req: Request, res: Response) {
    const data = await knowledgeService.localSearch(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listDataSources(req: Request, res: Response) {
    const data = await knowledgeService.listDataSources(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createDataSource(req: Request, res: Response) {
    const data = await knowledgeService.createDataSource(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async updateDataSource(req: Request, res: Response) {
    const data = await knowledgeService.updateDataSource(req.params.dataSourceId, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async archiveDataSource(req: Request, res: Response) {
    const data = await knowledgeService.archiveDataSource(req.params.dataSourceId, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async listBindings(req: Request, res: Response) {
    const data = await knowledgeService.listBindings(req.params.id, req.user!);
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async createBinding(req: Request, res: Response) {
    const data = await knowledgeService.createBinding(req.params.id, req.body, req.user!, requestContext(req));
    return res.status(201).json({ data, requestId: req.requestId });
  },

  async updateBinding(req: Request, res: Response) {
    const data = await knowledgeService.updateBinding(req.params.id, req.params.bindingId, req.body, req.user!, requestContext(req));
    return res.status(200).json({ data, requestId: req.requestId });
  },

  async removeBinding(req: Request, res: Response) {
    await knowledgeService.removeBinding(req.params.id, req.params.bindingId, req.user!, requestContext(req));
    return res.status(204).send();
  },
};
