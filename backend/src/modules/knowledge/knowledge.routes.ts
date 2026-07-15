import { raw, Router, type NextFunction, type Request, type Response } from 'express';
import { AppError } from '../../shared/errors/app-error';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { getKnowledgeUploadConfig } from './knowledge.config';
import { knowledgeController } from './knowledge.controller';
import {
  assistantKnowledgeBindingCreateSchema,
  assistantKnowledgeBindingParamsSchema,
  assistantKnowledgeBindingUpdateSchema,
  knowledgeBaseChildParamsSchema,
  knowledgeBaseCreateSchema,
  knowledgeBasesQuerySchema,
  knowledgeBaseUpdateSchema,
  knowledgeChunkParamsSchema,
  knowledgeChunksQuerySchema,
  knowledgeDataSourceCreateSchema,
  knowledgeDataSourceParamsSchema,
  knowledgeDataSourceUpdateSchema,
  knowledgeDocumentCreateSchema,
  knowledgeDocumentParamsSchema,
  knowledgeDocumentUpdateSchema,
  knowledgeEmbeddingRequestSchema,
  knowledgeIngestionJobParamsSchema,
  knowledgeIngestionRequestSchema,
  ragLocalSearchSchema,
  ragQueriesQuerySchema,
  ragQueryParamsSchema,
  ragQueryRequestSchema,
  ragSemanticSearchSchema,
} from './knowledge.schema';

function isPayloadTooLargeError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const bodyParserError = error as { status?: number; statusCode?: number; type?: string };
  return bodyParserError.status === 413 || bodyParserError.statusCode === 413 || bodyParserError.type === 'entity.too.large';
}

function knowledgeUploadRawParser() {
  return raw({ type: () => true, limit: getKnowledgeUploadConfig().maxUploadBytes });
}

function handleKnowledgeUploadParserError(error: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (isPayloadTooLargeError(error)) {
    return next(new AppError(413, 'KNOWLEDGE_UPLOAD_TOO_LARGE', 'O arquivo excede o limite configurado para upload de conhecimento.'));
  }
  return next(error);
}

export function createKnowledgeRouter() {
  const router = Router();

  router.get('/', requireAuth, requirePermission('knowledge.read'), validateQuery(knowledgeBasesQuerySchema), (req, res, next) => {
    void knowledgeController.listKnowledgeBases(req, res).catch(next);
  });
  router.post('/', requireAuth, requirePermission('knowledge.create'), validateBody(knowledgeBaseCreateSchema), (req, res, next) => {
    void knowledgeController.createKnowledgeBase(req, res).catch(next);
  });
  router.get('/:id', requireAuth, requirePermission('knowledge.read'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.getKnowledgeBase(req, res).catch(next);
  });
  router.get('/:id/readiness', requireAuth, requirePermission('knowledge.read'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.getKnowledgeBaseReadiness(req, res).catch(next);
  });
  router.patch(
    '/:id',
    requireAuth,
    requirePermission('knowledge.update'),
    validateParams(idParamsSchema),
    validateBody(knowledgeBaseUpdateSchema),
    (req, res, next) => {
      void knowledgeController.updateKnowledgeBase(req, res).catch(next);
    },
  );
  router.post('/:id/archive', requireAuth, requirePermission('knowledge.archive'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.archiveKnowledgeBase(req, res).catch(next);
  });
  router.post('/:id/restore', requireAuth, requirePermission('knowledge.restore'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.restoreKnowledgeBase(req, res).catch(next);
  });
  router.post(
    '/:id/request-embeddings',
    requireAuth,
    requirePermission('knowledge.ingestion.manage'),
    validateParams(knowledgeBaseChildParamsSchema),
    validateBody(knowledgeEmbeddingRequestSchema),
    (req, res, next) => {
      void knowledgeController.requestKnowledgeBaseEmbeddings(req, res).catch(next);
    },
  );

  router.get('/:id/documents', requireAuth, requirePermission('knowledge.read'), validateParams(knowledgeBaseChildParamsSchema), (req, res, next) => {
    void knowledgeController.listDocuments(req, res).catch(next);
  });
  router.get(
    '/:id/chunks',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(knowledgeBaseChildParamsSchema),
    validateQuery(knowledgeChunksQuerySchema),
    (req, res, next) => {
      void knowledgeController.listKnowledgeBaseChunks(req, res).catch(next);
    },
  );
  router.post(
    '/:id/documents',
    requireAuth,
    requirePermission('knowledge.update'),
    validateParams(knowledgeBaseChildParamsSchema),
    validateBody(knowledgeDocumentCreateSchema),
    (req, res, next) => {
      void knowledgeController.createDocument(req, res).catch(next);
    },
  );
  router.post(
    '/:id/documents/upload',
    requireAuth,
    requirePermission('knowledge.update'),
    validateParams(knowledgeBaseChildParamsSchema),
    knowledgeUploadRawParser(),
    handleKnowledgeUploadParserError,
    (req: Request, res: Response, next: NextFunction) => {
      void knowledgeController.uploadDocument(req, res).catch(next);
    },
  );
  router.get(
    '/:id/data-sources',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(knowledgeBaseChildParamsSchema),
    (req, res, next) => {
      void knowledgeController.listDataSources(req, res).catch(next);
    },
  );
  router.post(
    '/:id/data-sources',
    requireAuth,
    requirePermission('knowledge.update'),
    validateParams(knowledgeBaseChildParamsSchema),
    validateBody(knowledgeDataSourceCreateSchema),
    (req, res, next) => {
      void knowledgeController.createDataSource(req, res).catch(next);
    },
  );

  return router;
}

export function createKnowledgeDocumentsRouter() {
  const router = Router();

  router.get('/:documentId', requireAuth, requirePermission('knowledge.read'), validateParams(knowledgeDocumentParamsSchema), (req, res, next) => {
    void knowledgeController.getDocument(req, res).catch(next);
  });
  router.patch(
    '/:documentId',
    requireAuth,
    requirePermission('knowledge.update'),
    validateParams(knowledgeDocumentParamsSchema),
    validateBody(knowledgeDocumentUpdateSchema),
    (req, res, next) => {
      void knowledgeController.updateDocument(req, res).catch(next);
    },
  );
  router.post(
    '/:documentId/archive',
    requireAuth,
    requirePermission('knowledge.archive'),
    validateParams(knowledgeDocumentParamsSchema),
    (req, res, next) => {
      void knowledgeController.archiveDocument(req, res).catch(next);
    },
  );
  router.post(
    '/:documentId/request-ingestion',
    requireAuth,
    requirePermission('knowledge.ingestion.manage'),
    validateParams(knowledgeDocumentParamsSchema),
    validateBody(knowledgeIngestionRequestSchema),
    (req, res, next) => {
      void knowledgeController.requestIngestion(req, res).catch(next);
    },
  );
  router.post(
    '/:documentId/request-embeddings',
    requireAuth,
    requirePermission('knowledge.ingestion.manage'),
    validateParams(knowledgeDocumentParamsSchema),
    validateBody(knowledgeEmbeddingRequestSchema),
    (req, res, next) => {
      void knowledgeController.requestDocumentEmbeddings(req, res).catch(next);
    },
  );
  router.get(
    '/:documentId/ingestion',
    requireAuth,
    requirePermission('knowledge.ingestion.read'),
    validateParams(knowledgeDocumentParamsSchema),
    (req, res, next) => {
      void knowledgeController.listIngestionJobs(req, res).catch(next);
    },
  );
  router.get(
    '/:documentId/chunks',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(knowledgeDocumentParamsSchema),
    validateQuery(knowledgeChunksQuerySchema),
    (req, res, next) => {
      void knowledgeController.listDocumentChunks(req, res).catch(next);
    },
  );
  router.get(
    '/:documentId/source-references',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(knowledgeDocumentParamsSchema),
    (req, res, next) => {
      void knowledgeController.listDocumentSourceReferences(req, res).catch(next);
    },
  );

  return router;
}

export function createKnowledgeIngestionJobsRouter() {
  const router = Router();

  router.get('/:jobId', requireAuth, requirePermission('knowledge.ingestion.read'), validateParams(knowledgeIngestionJobParamsSchema), (req, res, next) => {
    void knowledgeController.getIngestionJob(req, res).catch(next);
  });

  return router;
}

export function createKnowledgeChunksRouter() {
  const router = Router();

  router.get('/:chunkId', requireAuth, requirePermission('knowledge.read'), validateParams(knowledgeChunkParamsSchema), (req, res, next) => {
    void knowledgeController.getChunk(req, res).catch(next);
  });
  router.get(
    '/:chunkId/source-references',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(knowledgeChunkParamsSchema),
    (req, res, next) => {
      void knowledgeController.listChunkSourceReferences(req, res).catch(next);
    },
  );

  return router;
}

export function createKnowledgeDataSourcesRouter() {
  const router = Router();

  router.patch(
    '/:dataSourceId',
    requireAuth,
    requirePermission('knowledge.update'),
    validateParams(knowledgeDataSourceParamsSchema),
    validateBody(knowledgeDataSourceUpdateSchema),
    (req, res, next) => {
      void knowledgeController.updateDataSource(req, res).catch(next);
    },
  );
  router.post(
    '/:dataSourceId/archive',
    requireAuth,
    requirePermission('knowledge.archive'),
    validateParams(knowledgeDataSourceParamsSchema),
    (req, res, next) => {
      void knowledgeController.archiveDataSource(req, res).catch(next);
    },
  );

  return router;
}

export function createRagQueriesRouter() {
  const router = Router();

  router.get('/:queryId', requireAuth, requirePermission('knowledge.read'), validateParams(ragQueryParamsSchema), (req, res, next) => {
    void knowledgeController.getRagQuery(req, res).catch(next);
  });
  router.get(
    '/:queryId/sources',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(ragQueryParamsSchema),
    (req, res, next) => {
      void knowledgeController.listRagQuerySources(req, res).catch(next);
    },
  );

  return router;
}

export function registerAssistantKnowledgeBindingRoutes(router: Router) {
  router.get('/:id/knowledge-bindings', requireAuth, requirePermission('knowledge.read'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.listBindings(req, res).catch(next);
  });
  router.post(
    '/:id/knowledge-bindings',
    requireAuth,
    requirePermission('knowledge.bind'),
    validateParams(idParamsSchema),
    validateBody(assistantKnowledgeBindingCreateSchema),
    (req, res, next) => {
      void knowledgeController.createBinding(req, res).catch(next);
    },
  );
  router.patch(
    '/:id/knowledge-bindings/:bindingId',
    requireAuth,
    requirePermission('knowledge.bind'),
    validateParams(assistantKnowledgeBindingParamsSchema),
    validateBody(assistantKnowledgeBindingUpdateSchema),
    (req, res, next) => {
      void knowledgeController.updateBinding(req, res).catch(next);
    },
  );
  router.delete(
    '/:id/knowledge-bindings/:bindingId',
    requireAuth,
    requirePermission('knowledge.bind'),
    validateParams(assistantKnowledgeBindingParamsSchema),
    (req, res, next) => {
      void knowledgeController.removeBinding(req, res).catch(next);
    },
  );
}

export function registerAssistantRagRoutes(router: Router) {
  router.post(
    '/:id/rag/semantic-search',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(idParamsSchema),
    validateBody(ragSemanticSearchSchema),
    (req, res, next) => {
      void knowledgeController.semanticSearch(req, res).catch(next);
    },
  );
  router.post(
    '/:id/rag/query',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(idParamsSchema),
    validateBody(ragQueryRequestSchema),
    (req, res, next) => {
      void knowledgeController.queryRag(req, res).catch(next);
    },
  );
  router.get(
    '/:id/rag/queries',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(idParamsSchema),
    validateQuery(ragQueriesQuerySchema),
    (req, res, next) => {
      void knowledgeController.listRagQueries(req, res).catch(next);
    },
  );
  router.get('/:id/rag/readiness', requireAuth, requirePermission('knowledge.read'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.getRagReadiness(req, res).catch(next);
  });
  router.get('/:id/rag-readiness', requireAuth, requirePermission('knowledge.read'), validateParams(idParamsSchema), (req, res, next) => {
    void knowledgeController.getRagReadiness(req, res).catch(next);
  });
  router.post(
    '/:id/rag-local-search',
    requireAuth,
    requirePermission('knowledge.read'),
    validateParams(idParamsSchema),
    validateBody(ragLocalSearchSchema),
    (req, res, next) => {
      void knowledgeController.localSearch(req, res).catch(next);
    },
  );
}
