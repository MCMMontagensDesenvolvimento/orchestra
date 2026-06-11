import type {
  AssistantKnowledgeBinding,
  ConnectorType,
  DataClassification,
  IngestionStatus,
  KnowledgeBase,
  KnowledgeDataSource,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeIngestionJob,
  KnowledgeSourceReference,
  RagLocalSearchResponse,
  RagReadiness,
  RetentionPeriod,
} from '@/types';
import { mockAssistants, mockKnowledgeBases, mockDocuments } from '@/services/mocks';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';
import { apiClient, type ApiEnvelope, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

interface ApiKnowledgePolicy {
  id: string;
  knowledgeBaseId: string;
  allowRuntimeRetrieval: boolean;
  allowCitationOnly: boolean;
  requireApprovalForExternal: boolean;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface ApiKnowledgeBase {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  visibility: 'private' | 'workspace' | 'tenant';
  dataClassification: 'public' | 'internal' | 'sensitive' | 'pii' | 'confidential';
  ownerUserId: string | null;
  owner?: { id: string; name: string; email: string } | null;
  metadata?: Record<string, unknown> | null;
  documentCount: number;
  chunkCount?: number;
  dataSourceCount: number;
  bindingCount: number;
  ingestionJobCount: number;
  policy?: ApiKnowledgePolicy | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiKnowledgeDocument {
  id: string;
  tenantId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  title: string;
  description: string | null;
  sourceType: string;
  sourceUri: string | null;
  mimeType: string | null;
  status: string;
  ingestionStatus: string;
  ingestionErrorCode: string | null;
  ingestionErrorMessage: string | null;
  dataClassification: string;
  contentText?: string | null;
  contentHash?: string | null;
  ingestedAt?: string | null;
  chunkCount?: number;
  metadata?: Record<string, unknown> | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiKnowledgeDataSource {
  id: string;
  tenantId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  name: string;
  type: string;
  config?: unknown;
  status: 'active' | 'disabled' | 'archived';
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiKnowledgeIngestionJob {
  id: string;
  tenantId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  documentId: string | null;
  status: string;
  strategy?: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  chunksCreated?: number;
  sourceReferencesCreated?: number;
  metadata?: unknown;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  events?: ApiKnowledgeIngestionEvent[];
}

interface ApiKnowledgeIngestionEvent {
  id: string;
  jobId: string;
  tenantId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  documentId: string | null;
  eventType: string;
  level: string;
  message: string | null;
  metadata?: unknown;
  createdAt: string;
}

interface ApiKnowledgeChunk {
  id: string;
  tenantId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenEstimate: number;
  charCount: number;
  status: 'active' | 'stale' | 'archived';
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface ApiKnowledgeSourceReference {
  id: string;
  tenantId: string;
  workspaceId: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkId: string | null;
  label: string;
  sourceType: string;
  sourceUri: string | null;
  sectionTitle: string | null;
  pageNumber: number | null;
  startOffset: number | null;
  endOffset: number | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

type ApiRagReadiness = RagReadiness;
type ApiRagLocalSearchResponse = RagLocalSearchResponse;

interface ApiAssistantKnowledgeBinding {
  id: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  knowledgeBaseId: string;
  isEnabled: boolean;
  retrievalMode: 'disabled' | 'citation_only' | 'retrieval_placeholder';
  priority: number;
  createdById: string | null;
  knowledgeBase?: ApiKnowledgeBase;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBasePayload {
  name: string;
  description?: string;
  visibility?: 'private' | 'workspace' | 'tenant';
  dataClassification?: 'public' | 'internal' | 'sensitive' | 'pii' | 'confidential';
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocumentPayload {
  title: string;
  description?: string;
  sourceType?: 'manual' | 'url' | 'file' | 'connector' | 'api' | 'other';
  sourceUri?: string;
  mimeType?: string;
  dataClassification?: 'public' | 'internal' | 'sensitive' | 'pii' | 'confidential';
  contentText?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDataSourcePayload {
  name: string;
  type?: 'manual' | 'url' | 'connector' | 'api' | 'storage' | 'other';
  config?: Record<string, unknown>;
  status?: 'active' | 'disabled' | 'archived';
}

export interface AssistantKnowledgeBindingPayload {
  knowledgeBaseId: string;
  isEnabled?: boolean;
  retrievalMode?: 'disabled' | 'citation_only' | 'retrieval_placeholder';
  priority?: number;
}

const connectorValues = new Set(['upload', 'sharepoint', 'confluence', 'google_drive', 's3', 'api']);

function formatDate(value?: string | null) {
  return value ? value.split('T')[0] : '';
}

function classificationFromApi(value: ApiKnowledgeBase['dataClassification'] | string): DataClassification {
  if (value === 'public') return 'Pֳ÷blico';
  if (value === 'internal') return 'Interno';
  if (value === 'sensitive') return 'Confidencial';
  return 'Restrito';
}

function statusFromBase(value: ApiKnowledgeBase['status']): IngestionStatus {
  return value === 'archived' ? 'archived' : 'completed';
}

function statusFromDocument(document: ApiKnowledgeDocument): IngestionStatus {
  if (document.status === 'archived') return 'archived';
  if (document.status === 'failed' || document.ingestionStatus === 'failed') return 'failed';
  if (document.ingestionStatus === 'queued' || document.ingestionStatus === 'running' || document.status === 'pending_ingestion') return 'processing';
  if (document.ingestionStatus === 'completed' || document.ingestionStatus === 'completed_placeholder' || document.status === 'indexed' || document.status === 'indexed_placeholder') return 'completed';
  return 'pending';
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string, fallback: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function connectorFromMetadata(metadata: Record<string, unknown> | null | undefined): ConnectorType {
  const value = metadata?.connectorType;
  return typeof value === 'string' && connectorValues.has(value) ? (value as ConnectorType) : 'api';
}

function mapKnowledgeBase(base: ApiKnowledgeBase): KnowledgeBase {
  const metadata = base.metadata ?? {};
  return {
    id: base.id,
    tenantId: base.tenantId,
    workspaceId: base.workspaceId,
    name: base.name,
    description: base.description ?? '',
    documentCount: base.documentCount,
    totalChunks: Number(base.chunkCount ?? metadata.totalChunks ?? 0),
    chunkCount: Number(base.chunkCount ?? metadata.totalChunks ?? 0),
    status: statusFromBase(base.status),
    lastUpdated: formatDate(base.updatedAt),
    size: metadataString(metadata, 'size', '0 MB'),
    assistants: [],
    classification: classificationFromApi(base.dataClassification),
    connectorType: connectorFromMetadata(metadata),
    embeddingModel: metadataString(metadata, 'embeddingModel', 'placeholder-not-configured'),
    chunkSize: Number(metadata.chunkSize ?? 512),
    chunkOverlap: Number(metadata.chunkOverlap ?? 64),
    retention: metadataString(metadata, 'retention', '2 anos') as RetentionPeriod,
    owner: base.owner?.name ?? base.ownerUserId ?? 'Orchestra',
    createdAt: formatDate(base.createdAt),
    updatedAt: base.updatedAt,
    deletedAt: base.deletedAt,
    visibility: base.visibility,
    dataClassification: base.dataClassification,
    bindingCount: base.bindingCount,
    dataSourceCount: base.dataSourceCount,
    ingestionJobCount: base.ingestionJobCount,
    policy: base.policy ?? null,
    metadata,
  };
}

function mapDocument(document: ApiKnowledgeDocument): KnowledgeDocument {
  const extension = document.mimeType?.split('/').pop()?.toUpperCase() ?? document.sourceType.toUpperCase();
  return {
    id: document.id,
    tenantId: document.tenantId,
    workspaceId: document.workspaceId,
    knowledgeBaseId: document.knowledgeBaseId,
    name: document.title,
    title: document.title,
    description: document.description,
    type: extension,
    sourceType: document.sourceType,
    sourceUri: document.sourceUri,
    mimeType: document.mimeType,
    size: metadataString(document.metadata, 'size', '0 MB'),
    status: statusFromDocument(document),
    ingestionStatus: document.ingestionStatus,
    ingestionErrorCode: document.ingestionErrorCode,
    ingestionErrorMessage: document.ingestionErrorMessage,
    dataClassification: document.dataClassification,
    contentText: document.contentText,
    contentHash: document.contentHash,
    ingestedAt: document.ingestedAt,
    metadata: document.metadata,
    chunks: Number(document.chunkCount ?? document.metadata?.chunks ?? 0),
    chunkCount: Number(document.chunkCount ?? document.metadata?.chunks ?? 0),
    version: metadataString(document.metadata, 'version', '1.0'),
    uploadedBy: document.createdById ?? 'Orchestra',
    uploadedAt: formatDate(document.createdAt),
    lastProcessed: document.ingestedAt ?? (document.ingestionStatus === 'completed' || document.ingestionStatus === 'completed_placeholder' ? document.updatedAt : ''),
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt,
  };
}

function mapDataSource(dataSource: ApiKnowledgeDataSource): KnowledgeDataSource {
  return {
    id: dataSource.id,
    tenantId: dataSource.tenantId,
    workspaceId: dataSource.workspaceId,
    knowledgeBaseId: dataSource.knowledgeBaseId,
    name: dataSource.name,
    type: dataSource.type,
    config: dataSource.config,
    status: dataSource.status,
    createdById: dataSource.createdById,
    createdAt: dataSource.createdAt,
    updatedAt: dataSource.updatedAt,
    deletedAt: dataSource.deletedAt,
  };
}

function mapIngestionJob(job: ApiKnowledgeIngestionJob): KnowledgeIngestionJob {
  return {
    id: job.id,
    tenantId: job.tenantId,
    workspaceId: job.workspaceId,
    knowledgeBaseId: job.knowledgeBaseId,
    documentId: job.documentId,
    status: job.status,
    strategy: job.strategy,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    chunksCreated: job.chunksCreated,
    sourceReferencesCreated: job.sourceReferencesCreated,
    metadata: job.metadata,
    createdById: job.createdById,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    events: job.events,
  };
}

function mapChunk(chunk: ApiKnowledgeChunk): KnowledgeChunk {
  return chunk;
}

function mapSourceReference(reference: ApiKnowledgeSourceReference): KnowledgeSourceReference {
  return reference;
}

function mockChunksForDocument(documentId: string): KnowledgeChunk[] {
  const document = mockDocuments.find((item) => item.id === documentId) ?? mockDocuments[0];
  const content = document.contentText ?? `Conteudo local simulado para ${document.name}. Este chunk demonstra readiness sem embeddings ou vector store.`;
  return [
    {
      id: `mock-chunk-${documentId}-1`,
      knowledgeBaseId: document.knowledgeBaseId,
      documentId,
      chunkIndex: 0,
      content,
      contentHash: `mock-hash-${documentId}`,
      tokenEstimate: Math.ceil(content.length / 4),
      charCount: content.length,
      status: 'active',
      metadata: { source: 'mock' },
      createdAt: document.lastProcessed || new Date().toISOString(),
      updatedAt: document.lastProcessed || new Date().toISOString(),
    },
  ];
}

function mockSourceReferencesForDocument(documentId: string): KnowledgeSourceReference[] {
  const document = mockDocuments.find((item) => item.id === documentId) ?? mockDocuments[0];
  return [
    {
      id: `mock-source-${documentId}-1`,
      knowledgeBaseId: document.knowledgeBaseId,
      documentId,
      chunkId: `mock-chunk-${documentId}-1`,
      label: `${document.name} #1`,
      sourceType: document.sourceType ?? 'manual',
      sourceUri: document.sourceUri ?? `mock://knowledge/${documentId}`,
      sectionTitle: document.name,
      pageNumber: null,
      startOffset: 0,
      endOffset: Math.max(1, document.name.length),
      metadata: { source: 'mock' },
      createdAt: document.lastProcessed || new Date().toISOString(),
      updatedAt: document.lastProcessed || new Date().toISOString(),
    },
  ];
}

function mapBinding(binding: ApiAssistantKnowledgeBinding): AssistantKnowledgeBinding {
  return {
    id: binding.id,
    tenantId: binding.tenantId,
    workspaceId: binding.workspaceId,
    assistantId: binding.assistantId,
    knowledgeBaseId: binding.knowledgeBaseId,
    isEnabled: binding.isEnabled,
    retrievalMode: binding.retrievalMode,
    priority: binding.priority,
    createdById: binding.createdById,
    knowledgeBase: binding.knowledgeBase ? mapKnowledgeBase(binding.knowledgeBase) : undefined,
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
  };
}

export const knowledgeService = {
  async list(): Promise<KnowledgeBase[]> {
    if (env.useMocks) return mockResponse(mockKnowledgeBases);
    const response = await apiClient.get<PaginatedApiEnvelope<ApiKnowledgeBase>>(endpoints.knowledge.list);
    return response.data.data.map(mapKnowledgeBase);
  },

  async get(id: string): Promise<KnowledgeBase> {
    if (env.useMocks) return mockFind(mockKnowledgeBases, id);
    const response = await apiClient.get<ApiEnvelope<ApiKnowledgeBase>>(endpoints.knowledge.detail(id));
    return mapKnowledgeBase(response.data.data);
  },

  async create(payload: KnowledgeBasePayload): Promise<KnowledgeBase> {
    if (env.useMocks) {
      return mockResponse({
        ...mockKnowledgeBases[0],
        id: `mock-kb-${Date.now()}`,
        name: payload.name,
        description: payload.description ?? '',
        status: 'pending',
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiKnowledgeBase>>(endpoints.knowledge.list, payload);
    return mapKnowledgeBase(response.data.data);
  },

  async update(id: string, payload: Partial<KnowledgeBasePayload>): Promise<KnowledgeBase> {
    if (env.useMocks) return mockFind(mockKnowledgeBases, id);
    const response = await apiClient.patch<ApiEnvelope<ApiKnowledgeBase>>(endpoints.knowledge.detail(id), payload);
    return mapKnowledgeBase(response.data.data);
  },

  async archive(id: string): Promise<KnowledgeBase> {
    if (env.useMocks) return mockFind(mockKnowledgeBases, id);
    const response = await apiClient.post<ApiEnvelope<ApiKnowledgeBase>>(endpoints.knowledge.archive(id));
    return mapKnowledgeBase(response.data.data);
  },

  async restore(id: string): Promise<KnowledgeBase> {
    if (env.useMocks) return mockFind(mockKnowledgeBases, id);
    const response = await apiClient.post<ApiEnvelope<ApiKnowledgeBase>>(endpoints.knowledge.restore(id));
    return mapKnowledgeBase(response.data.data);
  },

  async documents(knowledgeBaseId?: string): Promise<KnowledgeDocument[]> {
    if (env.useMocks) {
      const docs = knowledgeBaseId
        ? mockDocuments.filter(d => d.knowledgeBaseId === knowledgeBaseId)
        : mockDocuments;
      return mockResponse(docs);
    }
    if (!knowledgeBaseId) {
      const bases = await knowledgeService.list();
      const results = await Promise.all(bases.map((base) => knowledgeService.documents(base.id)));
      return results.flat();
    }
    const response = await apiClient.get<ApiEnvelope<ApiKnowledgeDocument[]>>(endpoints.knowledge.documents(knowledgeBaseId));
    return response.data.data.map(mapDocument);
  },

  async createDocument(knowledgeBaseId: string, payload: KnowledgeDocumentPayload): Promise<KnowledgeDocument> {
    if (env.useMocks) {
      return mockResponse({
        ...mockDocuments[0],
        id: `mock-doc-${Date.now()}`,
        knowledgeBaseId,
        name: payload.title,
        title: payload.title,
        contentText: payload.contentText,
        status: 'pending',
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiKnowledgeDocument>>(endpoints.knowledge.documents(knowledgeBaseId), payload);
    return mapDocument(response.data.data);
  },

  async archiveDocument(documentId: string): Promise<KnowledgeDocument> {
    if (env.useMocks) return mockFind(mockDocuments, documentId);
    const response = await apiClient.post<ApiEnvelope<ApiKnowledgeDocument>>(endpoints.knowledge.documentArchive(documentId));
    return mapDocument(response.data.data);
  },

  async requestIngestion(documentId: string): Promise<{ document: KnowledgeDocument; job: KnowledgeIngestionJob }> {
    if (env.useMocks) {
      const document = mockDocuments.find((item) => item.id === documentId) ?? mockDocuments[0];
      return mockResponse({
        document: { ...document, status: 'completed' as IngestionStatus },
        job: {
          id: `mock-ingestion-${Date.now()}`,
          knowledgeBaseId: document.knowledgeBaseId,
          documentId,
          status: 'completed',
          strategy: 'local_text_chunking',
          chunksCreated: 1,
          sourceReferencesCreated: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as KnowledgeIngestionJob,
      });
    }
    const response = await apiClient.post<ApiEnvelope<{ document: ApiKnowledgeDocument; job: ApiKnowledgeIngestionJob }>>(endpoints.knowledge.requestIngestion(documentId), {
      metadata: { source: 'frontend' },
    });
    return {
      document: mapDocument(response.data.data.document),
      job: mapIngestionJob(response.data.data.job),
    };
  },

  async ingestionJobs(documentId: string): Promise<KnowledgeIngestionJob[]> {
    if (env.useMocks) {
      return mockResponse([
        {
          id: `mock-ingestion-${documentId}`,
          knowledgeBaseId: mockDocuments.find((item) => item.id === documentId)?.knowledgeBaseId ?? '1',
          documentId,
          status: 'completed',
          strategy: 'local_text_chunking',
          chunksCreated: 1,
          sourceReferencesCreated: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as KnowledgeIngestionJob,
      ]);
    }
    const response = await apiClient.get<ApiEnvelope<ApiKnowledgeIngestionJob[]>>(endpoints.knowledge.documentIngestion(documentId));
    return response.data.data.map(mapIngestionJob);
  },

  async ingestionJob(jobId: string): Promise<KnowledgeIngestionJob> {
    if (env.useMocks) {
      return mockResponse({
        id: jobId,
        knowledgeBaseId: '1',
        documentId: 'd1',
        status: 'completed',
        strategy: 'local_text_chunking',
        chunksCreated: 1,
        sourceReferencesCreated: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [],
      } as KnowledgeIngestionJob);
    }
    const response = await apiClient.get<ApiEnvelope<ApiKnowledgeIngestionJob>>(endpoints.knowledge.ingestionJob(jobId));
    return mapIngestionJob(response.data.data);
  },

  async chunksByDocument(documentId: string): Promise<KnowledgeChunk[]> {
    if (env.useMocks) return mockResponse(mockChunksForDocument(documentId));
    const response = await apiClient.get<PaginatedApiEnvelope<ApiKnowledgeChunk>>(endpoints.knowledge.documentChunks(documentId));
    return response.data.data.map(mapChunk);
  },

  async sourceReferencesByDocument(documentId: string): Promise<KnowledgeSourceReference[]> {
    if (env.useMocks) return mockResponse(mockSourceReferencesForDocument(documentId));
    const response = await apiClient.get<ApiEnvelope<ApiKnowledgeSourceReference[]>>(endpoints.knowledge.documentSourceReferences(documentId));
    return response.data.data.map(mapSourceReference);
  },

  async ragReadiness(assistantId: string): Promise<RagReadiness> {
    if (env.useMocks) {
      const boundBases = mockKnowledgeBases.filter((kb) => mockAssistants.find((assistant) => assistant.id === assistantId)?.knowledgeBases.includes(kb.id));
      const chunksAvailable = boundBases.reduce((total, kb) => total + kb.totalChunks, 0);
      return mockResponse({
        assistantId,
        canUseKnowledge: boundBases.length > 0 && chunksAvailable > 0,
        knowledgeBasesBound: boundBases.length,
        documentsIngested: boundBases.reduce((total, kb) => total + kb.documentCount, 0),
        chunksAvailable,
        missingRequirements: boundBases.length === 0 ? ['NO_KNOWLEDGE_BASES_BOUND'] : [],
        retrievalMode: 'local_chunks_only',
        embeddingsEnabled: false,
        vectorStoreEnabled: false,
      });
    }
    const response = await apiClient.get<ApiEnvelope<ApiRagReadiness>>(endpoints.assistants.ragReadiness(assistantId));
    return response.data.data;
  },

  async ragLocalSearch(assistantId: string, query: string): Promise<RagLocalSearchResponse> {
    if (env.useMocks) {
      const assistant = mockAssistants.find((item) => item.id === assistantId);
      const boundDocument = mockDocuments.find((document) => assistant?.knowledgeBases.includes(document.knowledgeBaseId)) ?? mockDocuments[0];
      const chunks = mockChunksForDocument(boundDocument.id);
      return mockResponse({
        mode: 'keyword_local_placeholder',
        retrievalMode: 'local_chunks_only',
        embeddingsEnabled: false,
        vectorStoreEnabled: false,
        results: chunks
          .filter((chunk) => chunk.content.toLowerCase().includes(query.toLowerCase()))
          .map((chunk) => ({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            knowledgeBaseId: chunk.knowledgeBaseId,
            score: 1,
            snippet: chunk.content.slice(0, 240),
            source: {
              label: `${boundDocument.name} #1`,
              sourceUri: boundDocument.sourceUri ?? `mock://knowledge/${boundDocument.id}`,
              sectionTitle: boundDocument.name,
            },
          })),
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiRagLocalSearchResponse>>(endpoints.assistants.ragLocalSearch(assistantId), { query });
    return response.data.data;
  },

  async dataSources(knowledgeBaseId: string): Promise<KnowledgeDataSource[]> {
    if (env.useMocks) return mockResponse([]);
    const response = await apiClient.get<ApiEnvelope<ApiKnowledgeDataSource[]>>(endpoints.knowledge.dataSources(knowledgeBaseId));
    return response.data.data.map(mapDataSource);
  },

  async createDataSource(knowledgeBaseId: string, payload: KnowledgeDataSourcePayload): Promise<KnowledgeDataSource> {
    if (env.useMocks) {
      return mockResponse({
        id: `mock-data-source-${Date.now()}`,
        knowledgeBaseId,
        name: payload.name,
        type: payload.type ?? 'manual',
        config: payload.config,
        status: payload.status ?? 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as KnowledgeDataSource);
    }
    const response = await apiClient.post<ApiEnvelope<ApiKnowledgeDataSource>>(endpoints.knowledge.dataSources(knowledgeBaseId), payload);
    return mapDataSource(response.data.data);
  },

  async assistantBindings(assistantId: string): Promise<AssistantKnowledgeBinding[]> {
    if (env.useMocks) return mockResponse([]);
    const response = await apiClient.get<ApiEnvelope<ApiAssistantKnowledgeBinding[]>>(endpoints.assistants.knowledgeBindings(assistantId));
    return response.data.data.map(mapBinding);
  },

  async createAssistantBinding(assistantId: string, payload: AssistantKnowledgeBindingPayload): Promise<AssistantKnowledgeBinding> {
    if (env.useMocks) {
      return mockResponse({
        id: `mock-akb-${Date.now()}`,
        assistantId,
        knowledgeBaseId: payload.knowledgeBaseId,
        isEnabled: payload.isEnabled ?? true,
        retrievalMode: payload.retrievalMode ?? 'retrieval_placeholder',
        priority: payload.priority ?? 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as AssistantKnowledgeBinding);
    }
    const response = await apiClient.post<ApiEnvelope<ApiAssistantKnowledgeBinding>>(endpoints.assistants.knowledgeBindings(assistantId), payload);
    return mapBinding(response.data.data);
  },

  async updateAssistantBinding(assistantId: string, bindingId: string, payload: Partial<AssistantKnowledgeBindingPayload>): Promise<AssistantKnowledgeBinding> {
    if (env.useMocks) {
      return mockResponse({
        id: bindingId,
        assistantId,
        knowledgeBaseId: payload.knowledgeBaseId ?? '',
        isEnabled: payload.isEnabled ?? true,
        retrievalMode: payload.retrievalMode ?? 'retrieval_placeholder',
        priority: payload.priority ?? 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as AssistantKnowledgeBinding);
    }
    const response = await apiClient.patch<ApiEnvelope<ApiAssistantKnowledgeBinding>>(endpoints.assistants.knowledgeBinding(assistantId, bindingId), payload);
    return mapBinding(response.data.data);
  },

  async removeAssistantBinding(assistantId: string, bindingId: string): Promise<void> {
    if (env.useMocks) {
      await mockResponse(null);
      return;
    }
    await apiClient.delete(endpoints.assistants.knowledgeBinding(assistantId, bindingId));
  },
};
