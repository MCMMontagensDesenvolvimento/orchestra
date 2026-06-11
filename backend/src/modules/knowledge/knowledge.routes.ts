import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { idParamsSchema } from '../../shared/validation/pagination';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
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
  knowledgeIngestionJobParamsSchema,
  knowledgeIngestionRequestSchema,
  ragLocalSearchSchema,
  ragQueriesQuerySchema,
  ragQueryParamsSchema,
  ragQueryRequestSchema,
} from './knowledge.schema';

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
