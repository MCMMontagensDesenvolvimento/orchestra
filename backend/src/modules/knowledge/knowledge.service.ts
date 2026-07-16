import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { embeddingsService, type EmbeddingReadiness } from '../embeddings';
import {
  mapAssistantKnowledgeBinding,
  mapKnowledgeBase,
  mapKnowledgeChunk,
  mapKnowledgeDataSource,
  mapKnowledgeDocument,
  mapKnowledgeIngestionEvent,
  mapKnowledgeIngestionJob,
  mapKnowledgeSourceReference,
  mapRagQuery,
  mapRagQuerySource,
} from './knowledge.mapper';
import { knowledgeRepository } from './knowledge.repository';
import { chunkContentText, hashText, localChunkingDefaults, normalizeContentText } from './knowledge.chunking';
import { getKnowledgeRetrievalConfig } from './knowledge.config';
import { formatKnowledgeUploadSize, parseKnowledgeUpload } from './knowledge.upload';
import type {
  AssistantKnowledgeBindingCreateInput,
  AssistantKnowledgeBindingUpdateInput,
  KnowledgeBaseCreateInput,
  KnowledgeBasesQuery,
  KnowledgeBaseUpdateInput,
  KnowledgePolicyUpdateInput,
  KnowledgeChunksQuery,
  KnowledgeDataSourceCreateInput,
  KnowledgeDataSourceUpdateInput,
  KnowledgeDocumentCreateInput,
  KnowledgeDocumentUpdateInput,
  KnowledgeEmbeddingRequestInput,
  KnowledgeIngestionRequestInput,
  RagQueriesQuery,
  RagQueryRequestInput,
  RagLocalSearchInput,
  RagSemanticSearchInput,
} from './knowledge.schema';

interface RequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

type EmbeddingScope = 'document' | 'knowledge_base';
type SemanticFallbackReason =
  | 'EMBEDDINGS_NOT_READY'
  | 'NO_SEMANTIC_EMBEDDINGS'
  | 'SEMANTIC_NO_RESULTS'
  | 'SEMANTIC_RETRIEVAL_FAILED'
  | 'RAG_NOT_READY';
type OfficialRagMode =
  | 'semantic_vector'
  | 'semantic_fallback_local_keyword'
  | 'hybrid_keyword_semantic'
  | 'hybrid_stub_keyword_priority'
  | 'local_keyword'
  | 'local_readiness';

interface EmbeddingFailure {
  chunkId: string;
  code: string;
  message: string;
}

const unsafeMetadataKeys = new Set([
  'instructions',
  'prompt',
  'content',
  'secret',
  'secrets',
  'token',
  'tokens',
  'password',
  'apikey',
  'api_key',
  'apiKey',
  'authorization',
  'cookie',
  'privatekey',
  'private_key',
]);
const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 30)
      .map(([key, item]) => [
        key,
        unsafeMetadataKeys.has(key) || unsafeMetadataKeys.has(key.toLowerCase()) ? '[redacted]' : sanitizeMetadata(item, depth + 1),
      ]),
  );
}

async function audit(input: {
  user: AuthenticatedUser;
  context: RequestContext;
  action: string;
  entity: string;
  entityId?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await recordAuditEvent({
    tenantId: input.user.tenant.id,
    workspaceId: input.workspaceId,
    actorUserId: input.user.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    metadata: input.metadata ? (sanitizeMetadata(input.metadata) as Prisma.InputJsonValue) : undefined,
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
  });
}

async function recordDenied(user: AuthenticatedUser, context: RequestContext, workspaceId: string | undefined, policy: string) {
  await audit({
    user,
    context,
    action: 'permission_denied',
    entity: 'knowledge',
    workspaceId,
    metadata: { policy },
  });
}

async function assertWorkspace(user: AuthenticatedUser, workspaceId: string | undefined, context: RequestContext, policy: string) {
  if (workspaceId && userWorkspaceIds(user).includes(workspaceId)) return workspaceId;
  await recordDenied(user, context, workspaceId, policy);
  throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
}

async function resolveWorkspace(user: AuthenticatedUser, inputWorkspaceId: string | undefined, context: RequestContext, policy: string) {
  const workspaceId = inputWorkspaceId ?? user.workspaces[0]?.id;
  return assertWorkspace(user, workspaceId, context, policy);
}

async function getKnowledgeBaseOrThrow(id: string, user: AuthenticatedUser) {
  const base = await knowledgeRepository.findKnowledgeBaseById(id, user.tenant.id, userWorkspaceIds(user));
  if (!base) {
    throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
  }
  return base;
}

async function getAssistantOrThrow(id: string, user: AuthenticatedUser) {
  const assistant = await knowledgeRepository.findAssistant(id, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

function sourceUriForDocument(document: { id: string; sourceUri: string | null; sourceType: string }) {
  return document.sourceUri ?? `knowledge-document://${document.id}`;
}

function localSearchScore(content: string, query: string) {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;
  let index = normalizedContent.indexOf(normalizedQuery);
  while (index >= 0) {
    score += 1;
    index = normalizedContent.indexOf(normalizedQuery, index + normalizedQuery.length);
  }
  return Math.max(score, 1);
}

function localSearchSnippet(content: string, query: string) {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return content.slice(0, 240);
  const start = Math.max(0, index - 90);
  const end = Math.min(content.length, index + query.length + 150);
  return `${start > 0 ? '...' : ''}${content.slice(start, end)}${end < content.length ? '...' : ''}`;
}

function normalizeRagQuery(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ragStopWords = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'com',
  'da',
  'das',
  'de',
  'deve',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'por',
  'qual',
  'quais',
  'quando',
  'quantas',
  'quantos',
  'que',
  'segundo',
  'ser',
  'uma',
  'um',
]);

function ragTerms(value: string) {
  const normalized = normalizeRagQuery(value);
  const terms = normalized
    .split(' ')
    .filter((term) => term.length >= 2 && !ragStopWords.has(term));
  const phrases = [];
  for (let index = 0; index < terms.length - 1; index += 1) {
    phrases.push(`${terms[index]} ${terms[index + 1]}`);
  }
  return Array.from(new Set([normalized, ...phrases, ...terms].filter(Boolean))).slice(0, 32);
}

function originalSearchTerms(value: string) {
  const trimmed = value.trim();
  const terms = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((term) => term.length >= 2);
  return Array.from(new Set([trimmed, ...terms].filter(Boolean))).slice(0, 12);
}

function countOccurrences(content: string, term: string) {
  if (!term) return 0;
  let count = 0;
  let index = content.indexOf(term);
  while (index >= 0) {
    count += 1;
    index = content.indexOf(term, index + term.length);
  }
  return count;
}

function sourceNameFromUri(value: string | null | undefined) {
  if (!value) return '';
  if (/^(?:internal|localhost|private):/i.test(value)) return '';
  const withoutQuery = value.split(/[?#]/)[0] ?? value;
  const parts = withoutQuery.split(/[\\/]/).filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? withoutQuery;
  return normalizeRagQuery(lastPart.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''));
}

function safeExcerpt(content: string, terms: string[], maxLength = 600) {
  const normalizedContent = normalizeRagQuery(content);
  const firstTerm = terms.find((term) => normalizedContent.includes(term));
  const normalizedIndex = firstTerm ? normalizedContent.indexOf(firstTerm) : -1;
  const start = normalizedIndex >= 0 ? Math.max(0, normalizedIndex - 140) : 0;
  const end = Math.min(content.length, start + maxLength);
  const excerpt = `${start > 0 ? '...' : ''}${content.slice(start, end)}${end < content.length ? '...' : ''}`;
  return excerpt.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function scoreRagCandidate(candidate: {
  content: string;
  document: { title: string; sourceUri: string | null };
  sourceReferences: Array<{ label: string; sourceUri: string | null; sectionTitle: string | null }>;
}, terms: string[]) {
  const content = normalizeRagQuery(candidate.content);
  const title = normalizeRagQuery(candidate.document.title);
  const documentSource = sourceNameFromUri(candidate.document.sourceUri);
  const referenceText = normalizeRagQuery(
    candidate.sourceReferences
      .map((reference) => `${reference.label} ${reference.sectionTitle ?? ''} ${sourceNameFromUri(reference.sourceUri)}`)
      .join(' '),
  );
  const metadataText = normalizeRagQuery(`${title} ${documentSource} ${referenceText}`);

  let contentScore = 0;
  let titleScore = 0;
  let metadataScore = 0;
  for (const term of terms) {
    const phraseBoost = term.includes(' ') ? 2 : 1;
    contentScore += countOccurrences(content, term) * phraseBoost;
    titleScore += countOccurrences(title, term) * (term.includes(' ') ? 10 : 4);
    metadataScore += countOccurrences(metadataText, term) * (term.includes(' ') ? 8 : 3);
  }

  const rawScore = contentScore + titleScore + metadataScore;
  if (rawScore <= 0) return null;
  const matchSections = [
    titleScore > 0 ? 'title' : null,
    contentScore > 0 ? 'content' : null,
    metadataScore > 0 ? 'metadata' : null,
  ].filter(Boolean);
  const matchType = matchSections.length > 1 ? 'mixed' : (matchSections[0] ?? 'content');

  return {
    score: Number(Math.min(0.99, rawScore / (rawScore + 4)).toFixed(4)),
    rawScore,
    matchType,
  };
}

function mapReadiness(readiness: Awaited<ReturnType<typeof knowledgeRepository.getRagReadiness>>) {
  if (!readiness) return null;
  const embeddings = embeddingsService.getEmbeddingReadiness();
  const retrievalConfig = getKnowledgeRetrievalConfig();
  const keywordReady = readiness.blockedReasons.length === 0;
  const embeddingsAvailable = readiness.embeddingsAvailable ?? 0;
  const semanticReady = keywordReady && embeddings.status === 'ready' && embeddingsAvailable > 0;
  const ready = retrievalConfig.mode === 'semantic' ? semanticReady : keywordReady;
  const blockedReasons = [...readiness.blockedReasons];
  if (retrievalConfig.mode === 'semantic' && keywordReady && !semanticReady) {
    blockedReasons.push(embeddings.status === 'ready' ? 'NO_SEMANTIC_EMBEDDINGS' : 'EMBEDDINGS_NOT_READY');
  }
  const effectiveRetrievalMode = !keywordReady
    ? 'none'
    : retrievalConfig.mode === 'keyword'
      ? 'keyword'
      : semanticReady
        ? retrievalConfig.mode
        : retrievalConfig.mode === 'hybrid'
          ? 'keyword'
          : 'none';
  const status = ready
    ? retrievalConfig.mode === 'hybrid' && !semanticReady ? 'degraded' : 'ready'
    : keywordReady ? 'degraded' : 'not_ready';
  return {
    assistantId: readiness.assistant.id,
    ready,
    canUseKnowledge: ready,
    knowledgeBaseCount: readiness.knowledgeBaseCount,
    documentCount: readiness.documentCount,
    chunkCount: readiness.chunkCount,
    sourceReferenceCount: readiness.sourceReferenceCount,
    enabledBindingCount: readiness.enabledBindingCount,
    blockedReasons,
    warnings: readiness.warnings,
    knowledgeBasesBound: readiness.knowledgeBasesBound,
    documentsIngested: readiness.documentsIngested,
    chunksAvailable: readiness.chunksAvailable,
    missingRequirements: blockedReasons,
    retrievalMode: 'local_chunks_only',
    retrievalModeConfigured: retrievalConfig.mode,
    effectiveRetrievalMode,
    status,
    keywordReady,
    semanticReady,
    documentsAuthorized: readiness.documentsIngested,
    chunksAuthorized: readiness.chunksAvailable,
    embeddingsAvailable,
    embeddingsEnabled: embeddings.status === 'ready',
    embeddings,
    vectorStoreEnabled: semanticReady,
  };
}

interface RagSearchChunk {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  content: string;
  chunkIndex: number;
  tokenEstimate: number;
  charCount: number;
  document: {
    title: string;
    sourceUri: string | null;
    sourceType: string;
  };
  sourceReferences: Array<{
    id?: string | null;
    label: string;
    sourceUri: string | null;
    sectionTitle: string | null;
  }>;
  semanticScore?: number;
  semanticDistance?: number;
}

interface OfficialRagSelectedResult {
  knowledgeBaseId: string;
  documentId: string;
  chunkId: string;
  sourceReferenceId?: string | null;
  rank: number;
  score: number;
  matchType: string;
  excerpt: string;
  citationLabel: string;
  metadata: Prisma.InputJsonValue;
}

interface OfficialRagRetrievalResolution {
  mode: OfficialRagMode;
  retrievalMode: OfficialRagMode;
  semanticEnabled: boolean;
  keywordUsed: boolean;
  semanticUsed: boolean;
  hybridMergeApplied: boolean;
  stubKeywordPriority: boolean;
  vectorStoreUsed: boolean;
  fallbackUsed: boolean;
  fallbackReason: SemanticFallbackReason | null;
  provider: string | null;
  model: string | null;
  dimension: number | null;
  selectedResults: OfficialRagSelectedResult[];
}

function mapRagSearchSource(chunk: RagSearchChunk) {
  const reference = chunk.sourceReferences[0];
  return {
    label: reference?.label ?? chunk.document.title,
    sourceUri: reference?.sourceUri ?? chunk.document.sourceUri ?? null,
    sectionTitle: reference?.sectionTitle ?? null,
  };
}

function mapSemanticSearchResults(chunks: RagSearchChunk[], normalizedTerms: string[]) {
  return chunks.map((chunk) => ({
    chunkId: chunk.id,
    documentId: chunk.documentId,
    knowledgeBaseId: chunk.knowledgeBaseId,
    score: Number((chunk.semanticScore ?? 0).toFixed(6)),
    semanticDistance: Number((chunk.semanticDistance ?? 0).toFixed(6)),
    matchType: 'semantic_vector',
    snippet: safeExcerpt(chunk.content, normalizedTerms, 360),
    source: mapRagSearchSource(chunk),
  }));
}

function mapLexicalFallbackResults(input: {
  chunks: RagSearchChunk[];
  normalizedTerms: string[];
  priorityByKnowledgeBaseId: Map<string, number>;
  limit: number;
}) {
  return input.chunks
    .map((chunk) => {
      const score = scoreRagCandidate(chunk, input.normalizedTerms);
      if (!score) return null;
      return {
        chunk,
        score: score.score,
        rawScore: score.rawScore,
        matchType: score.matchType,
        priority: input.priorityByKnowledgeBaseId.get(chunk.knowledgeBaseId) ?? 1000,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) =>
      right.score - left.score ||
      left.priority - right.priority ||
      left.chunk.document.title.localeCompare(right.chunk.document.title) ||
      left.chunk.chunkIndex - right.chunk.chunkIndex ||
      left.chunk.id.localeCompare(right.chunk.id),
    )
    .slice(0, input.limit)
    .map((item) => ({
      chunkId: item.chunk.id,
      documentId: item.chunk.documentId,
      knowledgeBaseId: item.chunk.knowledgeBaseId,
      score: item.score,
      semanticDistance: null,
      matchType: item.matchType,
      snippet: safeExcerpt(item.chunk.content, input.normalizedTerms, 360),
      source: mapRagSearchSource(item.chunk),
    }));
}

function embeddingReadinessMetadata(readiness: EmbeddingReadiness) {
  return {
    provider: readiness.model && readiness.dimension ? readiness.provider : null,
    model: readiness.model,
    dimension: readiness.dimension,
  };
}

function buildLexicalOfficialRagResults(input: {
  chunks: RagSearchChunk[];
  normalizedTerms: string[];
  priorityByKnowledgeBaseId: Map<string, number>;
  limit: number;
  maxExcerptChars: number;
  scoreThreshold: number;
}) {
  const scoredResults: Array<{
    chunk: RagSearchChunk;
    score: number;
    rawScore: number;
    matchType: string;
    priority: number;
  }> = [];

  for (const chunk of input.chunks) {
    const score = scoreRagCandidate(chunk, input.normalizedTerms);
    if (!score) continue;
    scoredResults.push({
      chunk,
      score: score.score,
      rawScore: score.rawScore,
      matchType: score.matchType,
      priority: input.priorityByKnowledgeBaseId.get(chunk.knowledgeBaseId) ?? 1000,
    });
  }

  return scoredResults
    .sort((left, right) =>
      right.score - left.score ||
      left.priority - right.priority ||
      left.chunk.document.title.localeCompare(right.chunk.document.title) ||
      left.chunk.chunkIndex - right.chunk.chunkIndex ||
      left.chunk.id.localeCompare(right.chunk.id),
    )
    .filter((item) => item.score >= input.scoreThreshold)
    .slice(0, input.limit)
    .map((item, index): OfficialRagSelectedResult => {
      const sourceReference = item.chunk.sourceReferences[0];
      return {
        knowledgeBaseId: item.chunk.knowledgeBaseId,
        documentId: item.chunk.documentId,
        chunkId: item.chunk.id,
        sourceReferenceId: sourceReference?.id,
        rank: index + 1,
        score: item.score,
        matchType: item.matchType,
        excerpt: safeExcerpt(item.chunk.content, input.normalizedTerms, input.maxExcerptChars),
        citationLabel: `Fonte ${index + 1}`,
        metadata: sanitizeMetadata({
          rawScore: item.rawScore,
          chunkIndex: item.chunk.chunkIndex,
          tokenEstimate: item.chunk.tokenEstimate,
          charCount: item.chunk.charCount,
          documentTitle: item.chunk.document.title,
          sourceReferenceLabel: sourceReference?.label,
          sourceName: sourceNameFromUri(sourceReference?.sourceUri ?? item.chunk.document.sourceUri),
          sourceType: item.chunk.document.sourceType,
          sectionTitle: sourceReference?.sectionTitle,
        }) as Prisma.InputJsonValue,
      };
    });
}

function buildSemanticOfficialRagResults(input: {
  chunks: RagSearchChunk[];
  normalizedTerms: string[];
  limit: number;
  maxExcerptChars: number;
  scoreThreshold: number;
}) {
  return input.chunks
    .filter((chunk) => (chunk.semanticScore ?? 0) >= input.scoreThreshold)
    .slice(0, input.limit)
    .map((chunk, index): OfficialRagSelectedResult => {
    const sourceReference = chunk.sourceReferences[0];
    const semanticScore = Number((chunk.semanticScore ?? 0).toFixed(6));
    const semanticDistance = Number((chunk.semanticDistance ?? 0).toFixed(6));
    return {
      knowledgeBaseId: chunk.knowledgeBaseId,
      documentId: chunk.documentId,
      chunkId: chunk.id,
      sourceReferenceId: sourceReference?.id,
      rank: index + 1,
      score: semanticScore,
      matchType: 'semantic_vector',
      excerpt: safeExcerpt(chunk.content, input.normalizedTerms, input.maxExcerptChars),
      citationLabel: `Fonte ${index + 1}`,
      metadata: sanitizeMetadata({
        semanticDistance,
        semanticScore,
        chunkIndex: chunk.chunkIndex,
        tokenEstimate: chunk.tokenEstimate,
        charCount: chunk.charCount,
        documentTitle: chunk.document.title,
        sourceReferenceLabel: sourceReference?.label,
        sourceName: sourceNameFromUri(sourceReference?.sourceUri ?? chunk.document.sourceUri),
        sourceType: chunk.document.sourceType,
        sectionTitle: sourceReference?.sectionTitle,
      }) as Prisma.InputJsonValue,
    };
    });
}

function rerankRagResults(results: OfficialRagSelectedResult[]) {
  return results.map((result, index) => ({
    ...result,
    rank: index + 1,
    citationLabel: `Fonte ${index + 1}`,
  }));
}

function metadataRecord(value: Prisma.InputJsonValue): Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function withMergedMetadata(result: OfficialRagSelectedResult, metadata: Record<string, unknown>) {
  return {
    ...result,
    metadata: sanitizeMetadata({
      ...metadataRecord(result.metadata),
      ...metadata,
    }) as Prisma.InputJsonValue,
  };
}

function mergeHybridOfficialRagResults(input: {
  lexicalResults: OfficialRagSelectedResult[];
  semanticResults: OfficialRagSelectedResult[];
  limit: number;
  stubKeywordPriority: boolean;
}) {
  const byChunkId = new Map<string, OfficialRagSelectedResult>();
  const semanticByChunkId = new Map(input.semanticResults.map((result) => [result.chunkId, result]));

  for (const lexical of input.lexicalResults) {
    const semantic = semanticByChunkId.get(lexical.chunkId);
    byChunkId.set(lexical.chunkId, semantic
      ? withMergedMetadata(lexical, {
        semanticAuxiliary: true,
        semanticScore: semantic.score,
        semanticMatchType: semantic.matchType,
        semanticMetadata: metadataRecord(semantic.metadata),
      })
      : lexical);
  }

  for (const semantic of input.semanticResults) {
    if (byChunkId.has(semantic.chunkId)) continue;
    byChunkId.set(semantic.chunkId, input.stubKeywordPriority
      ? withMergedMetadata(semantic, {
        semanticAuxiliary: true,
        rankingDemoted: true,
        rankingReason: 'stub_keyword_priority',
      })
      : semantic);
  }

  const merged = Array.from(byChunkId.values())
    .sort((left, right) => {
      const leftLexical = left.matchType !== 'semantic_vector';
      const rightLexical = right.matchType !== 'semantic_vector';
      if (input.stubKeywordPriority && leftLexical !== rightLexical) return leftLexical ? -1 : 1;
      return right.score - left.score || left.rank - right.rank || left.chunkId.localeCompare(right.chunkId);
    })
    .slice(0, input.limit);

  return rerankRagResults(merged);
}

function applyRagContextLimit(results: OfficialRagSelectedResult[], maxContextChars: number) {
  const selected: OfficialRagSelectedResult[] = [];
  let contextChars = 0;
  for (const result of results) {
    const remaining = maxContextChars - contextChars;
    if (remaining <= 0) break;
    const excerpt = result.excerpt.slice(0, remaining).trim();
    if (!excerpt) continue;
    const rank = selected.length + 1;
    selected.push({ ...result, rank, citationLabel: `Fonte ${rank}`, excerpt });
    contextChars += excerpt.length;
  }
  return selected;
}

async function resolveOfficialRagRetrieval(input: {
  assistantId: string;
  tenantId: string;
  workspaceIds: string[];
  query: string;
  limit: number;
  normalizedTerms: string[];
  requestId: string;
  embeddingReadiness: EmbeddingReadiness;
  lexicalResult: NonNullable<Awaited<ReturnType<typeof knowledgeRepository.findRagRetrievalCandidates>>>;
}): Promise<OfficialRagRetrievalResolution> {
  const retrievalConfig = getKnowledgeRetrievalConfig();
  const { provider, model, dimension } = embeddingReadinessMetadata(input.embeddingReadiness);
  const priorityByKnowledgeBaseId = new Map(
    input.lexicalResult.readiness.activeBindings.map((binding) => [binding.knowledgeBaseId, binding.priority]),
  );
  const localResults = () => buildLexicalOfficialRagResults({
    chunks: input.lexicalResult.chunks,
    normalizedTerms: input.normalizedTerms,
    priorityByKnowledgeBaseId,
    limit: input.limit,
    maxExcerptChars: retrievalConfig.maxExcerptChars,
    scoreThreshold: retrievalConfig.scoreThreshold,
  });
  const fallback = (reason: SemanticFallbackReason): OfficialRagRetrievalResolution => {
    const semanticAttempted = reason !== 'EMBEDDINGS_NOT_READY' && reason !== 'RAG_NOT_READY';
    const vectorStoreUsed = reason === 'NO_SEMANTIC_EMBEDDINGS' || reason === 'SEMANTIC_NO_RESULTS';
    return {
      mode: 'semantic_fallback_local_keyword',
      retrievalMode: 'semantic_fallback_local_keyword',
      semanticEnabled: input.embeddingReadiness.status === 'ready',
      keywordUsed: true,
      semanticUsed: semanticAttempted,
      hybridMergeApplied: false,
      stubKeywordPriority: false,
      vectorStoreUsed,
      fallbackUsed: true,
      fallbackReason: reason,
      provider,
      model,
      dimension,
      selectedResults: applyRagContextLimit(localResults(), retrievalConfig.maxContextChars),
    };
  };

  if (retrievalConfig.mode === 'keyword') {
    return {
      mode: 'local_keyword',
      retrievalMode: 'local_keyword',
      semanticEnabled: false,
      keywordUsed: true,
      semanticUsed: false,
      hybridMergeApplied: false,
      stubKeywordPriority: false,
      vectorStoreUsed: false,
      fallbackUsed: false,
      fallbackReason: null,
      provider,
      model,
      dimension,
      selectedResults: applyRagContextLimit(localResults(), retrievalConfig.maxContextChars),
    };
  }

  if (input.embeddingReadiness.status !== 'ready' || !model || !dimension) {
    return fallback('EMBEDDINGS_NOT_READY');
  }

  let queryEmbedding: Awaited<ReturnType<typeof embeddingsService.embedText>>;
  try {
    queryEmbedding = await embeddingsService.embedText({
      text: input.query,
      requestId: input.requestId,
      model,
      metadata: {
        scope: 'rag_query',
        assistantId: input.assistantId,
        rawInputStored: false,
        rawOutputStored: false,
      },
    });
    if (!Array.isArray(queryEmbedding.vector) || queryEmbedding.vector.length !== dimension || !queryEmbedding.vector.every(Number.isFinite)) {
      throw new AppError(502, 'EMBEDDING_DIMENSION_MISMATCH', 'Embedding provider returned a vector with unexpected dimension.');
    }
  } catch (error) {
    if (retrievalConfig.mode === 'hybrid') return fallback('SEMANTIC_RETRIEVAL_FAILED');
    throw new AppError(503, 'RAG_EMBEDDING_FAILED', 'Falha governada ao gerar embedding para retrieval semantico.');
  }

  try {
    const semanticResult = await knowledgeRepository.findSemanticRagRetrievalCandidates({
      assistantId: input.assistantId,
      tenantId: input.tenantId,
      workspaceIds: input.workspaceIds,
      queryVector: queryEmbedding.vector,
      provider: input.embeddingReadiness.provider,
      model,
      dimension,
      take: input.limit,
    });
    if (!semanticResult) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    if (semanticResult.chunks.length === 0) {
      const reason = semanticResult.semanticCandidateCount === 0 ? 'NO_SEMANTIC_EMBEDDINGS' : 'SEMANTIC_NO_RESULTS';
      if (retrievalConfig.mode === 'hybrid') return fallback(reason);
      return {
        mode: 'semantic_vector',
        retrievalMode: 'semantic_vector',
        semanticEnabled: true,
        keywordUsed: false,
        semanticUsed: true,
        hybridMergeApplied: false,
        stubKeywordPriority: false,
        vectorStoreUsed: true,
        fallbackUsed: false,
        fallbackReason: reason,
        provider,
        model,
        dimension,
        selectedResults: [],
      };
    }

    const semanticResults = buildSemanticOfficialRagResults({
      chunks: semanticResult.chunks,
      normalizedTerms: input.normalizedTerms,
      limit: input.limit,
      maxExcerptChars: retrievalConfig.maxExcerptChars,
      scoreThreshold: retrievalConfig.scoreThreshold,
    });
    if (retrievalConfig.mode === 'hybrid') {
      const lexicalResults = localResults();
      const stubKeywordPriority = input.embeddingReadiness.provider === 'stub';
      const mergedResults = mergeHybridOfficialRagResults({
        lexicalResults,
        semanticResults,
        limit: input.limit,
        stubKeywordPriority,
      });
      return {
        mode: stubKeywordPriority ? 'hybrid_stub_keyword_priority' : 'hybrid_keyword_semantic',
        retrievalMode: stubKeywordPriority ? 'hybrid_stub_keyword_priority' : 'hybrid_keyword_semantic',
        semanticEnabled: true,
        keywordUsed: true,
        semanticUsed: true,
        hybridMergeApplied: true,
        stubKeywordPriority,
        vectorStoreUsed: true,
        fallbackUsed: false,
        fallbackReason: null,
        provider,
        model,
        dimension,
        selectedResults: applyRagContextLimit(mergedResults, retrievalConfig.maxContextChars),
      };
    }
    return {
      mode: 'semantic_vector',
      retrievalMode: 'semantic_vector',
      semanticEnabled: true,
      keywordUsed: false,
      semanticUsed: true,
      hybridMergeApplied: false,
      stubKeywordPriority: false,
      vectorStoreUsed: true,
      fallbackUsed: false,
      fallbackReason: null,
      provider,
      model,
      dimension,
      selectedResults: applyRagContextLimit(semanticResults, retrievalConfig.maxContextChars),
    };
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      throw error;
    }
    throw new AppError(503, 'RAG_RETRIEVAL_FAILED', 'Retrieval governado falhou antes da execucao do runtime.');
  }
}

function embeddingConfigOrThrow() {
  const readiness = embeddingsService.getEmbeddingReadiness();
  if (readiness.status !== 'ready' || !readiness.model || !readiness.dimension) {
    throw new AppError(409, 'EMBEDDINGS_NOT_READY', readiness.reason);
  }
  return {
    provider: readiness.provider,
    model: readiness.model,
    dimension: readiness.dimension,
  };
}

function embeddingHash(vector: number[]) {
  return hashText(vector.map((value) => value.toPrecision(12)).join(','));
}

function embeddingSummaryStatus(embedded: number, skipped: number, failed: number) {
  if (failed > 0 && embedded + skipped === 0) return 'failed';
  if (failed > 0) return 'partial';
  return 'completed';
}

function embeddingErrorCode(error: unknown) {
  if (error instanceof AppError) return error.code;
  const maybeCode = (error as { code?: unknown })?.code;
  if (typeof maybeCode === 'string' && maybeCode.trim()) {
    return maybeCode.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase().slice(0, 120);
  }
  return 'EMBEDDING_CHUNK_FAILED';
}

function embeddingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? 'Embedding chunk failed.');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/gi, '[redacted]')
    .replace(/(api[_-]?key|authorization|token|secret)\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[redacted]')
    .slice(0, 500);
}

async function processEmbeddingChunks(input: {
  scope: EmbeddingScope;
  scopeId: string;
  chunks: Awaited<ReturnType<typeof knowledgeRepository.listDocumentChunksForEmbedding>>;
  request: KnowledgeEmbeddingRequestInput;
  user: AuthenticatedUser;
  context: RequestContext;
}) {
  const embeddingConfig = embeddingConfigOrThrow();
  const existing = input.request.force || input.chunks.length === 0
    ? []
    : await knowledgeRepository.listExistingEmbeddedChunkEmbeddings({
        chunkIds: input.chunks.map((chunk) => chunk.id),
        provider: embeddingConfig.provider,
        model: embeddingConfig.model,
        dimension: embeddingConfig.dimension,
        contentHashes: Array.from(new Set(input.chunks.map((chunk) => chunk.contentHash))),
      });

  const existingKeys = new Set(existing.map((row) => `${row.chunkId}:${row.contentHash}`));
  const chunksToEmbed = input.chunks.filter((chunk) => !existingKeys.has(`${chunk.id}:${chunk.contentHash}`));
  const failures: EmbeddingFailure[] = [];
  let embedded = 0;

  for (const chunk of chunksToEmbed) {
    try {
      const result = await embeddingsService.embedText({
        text: chunk.content,
        requestId: input.context.requestId,
        model: embeddingConfig.model,
        metadata: {
          scope: input.scope,
          scopeId: input.scopeId,
          chunkId: chunk.id,
          rawInputStored: false,
          rawOutputStored: false,
        },
      });

      if (result.vector.length !== embeddingConfig.dimension) {
        throw new AppError(502, 'EMBEDDING_DIMENSION_MISMATCH', 'Embedding provider returned a vector with unexpected dimension.');
      }

      await knowledgeRepository.upsertEmbeddedChunkEmbedding({
        tenantId: chunk.tenantId,
        workspaceId: chunk.workspaceId,
        knowledgeBaseId: chunk.knowledgeBaseId,
        documentId: chunk.documentId,
        chunkId: chunk.id,
        provider: embeddingConfig.provider,
        model: embeddingConfig.model,
        dimension: embeddingConfig.dimension,
        embedding: result.vector,
        contentHash: chunk.contentHash,
        embeddingHash: embeddingHash(result.vector),
        embeddedAt: new Date(),
        metadata: sanitizeMetadata({
          ...(input.request.metadata ?? {}),
          scope: input.scope,
          scopeId: input.scopeId,
          requestedById: input.user.id,
          requestId: input.context.requestId,
          externalProviderCalled: result.metadata?.externalProviderCalled ?? true,
          rawInputStored: false,
          rawOutputStored: false,
          usage: result.usage,
        }) as Prisma.InputJsonValue,
      });
      embedded += 1;
    } catch (error) {
      const code = embeddingErrorCode(error);
      const message = embeddingErrorMessage(error);
      failures.push({ chunkId: chunk.id, code, message });
      await knowledgeRepository.upsertFailedChunkEmbedding({
        tenantId: chunk.tenantId,
        workspaceId: chunk.workspaceId,
        knowledgeBaseId: chunk.knowledgeBaseId,
        documentId: chunk.documentId,
        chunkId: chunk.id,
        provider: embeddingConfig.provider,
        model: embeddingConfig.model,
        dimension: embeddingConfig.dimension,
        contentHash: chunk.contentHash,
        errorCode: code,
        errorMessage: message,
        metadata: sanitizeMetadata({
          ...(input.request.metadata ?? {}),
          scope: input.scope,
          scopeId: input.scopeId,
          requestedById: input.user.id,
          requestId: input.context.requestId,
          errorCode: code,
          rawInputStored: false,
          rawOutputStored: false,
        }) as Prisma.InputJsonValue,
      });
    }
  }

  const skipped = input.chunks.length - chunksToEmbed.length;
  const failed = failures.length;
  const status = embeddingSummaryStatus(embedded, skipped, failed);

  return {
    scope: input.scope,
    scopeId: input.scopeId,
    status,
    provider: embeddingConfig.provider,
    model: embeddingConfig.model,
    dimension: embeddingConfig.dimension,
    requestedChunks: input.chunks.length,
    selectedForEmbedding: chunksToEmbed.length,
    embedded,
    skipped,
    failed,
    failures,
    retrievalMode: 'local_chunks_only',
    ragUpdated: false,
    vectorSearchEnabled: false,
  };
}

async function recordFailedIngestionJob(input: {
  documentId: string;
  errorCode: string;
  errorMessage: string;
  user: AuthenticatedUser;
  metadata?: Record<string, unknown>;
}) {
  return knowledgeRepository.recordFailedIngestion({
    documentId: input.documentId,
    tenantId: input.user.tenant.id,
    workspaceIds: userWorkspaceIds(input.user),
    createdById: input.user.id,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    metadata: sanitizeMetadata({
      ...(input.metadata ?? {}),
      strategy: 'local_text_chunking',
      requestedById: input.user.id,
    }) as Prisma.InputJsonValue,
  });
}

export const knowledgeService = {
  async listKnowledgeBases(user: AuthenticatedUser, query: KnowledgeBasesQuery, context: RequestContext) {
    if (query.workspaceId) {
      await assertWorkspace(user, query.workspaceId, context, 'listKnowledgeBases');
    }
    const result = await knowledgeRepository.listKnowledgeBases(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapKnowledgeBase),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getKnowledgeBase(id: string, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(id, user);
    return mapKnowledgeBase(base);
  },

  async getKnowledgeBaseReadiness(id: string, user: AuthenticatedUser) {
    const readiness = await knowledgeRepository.getKnowledgeBaseReadiness(id, user.tenant.id, userWorkspaceIds(user));
    if (!readiness) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }
    const embeddings = embeddingsService.getEmbeddingReadiness();
    const retrieval = getKnowledgeRetrievalConfig();
    const blockedReasons: string[] = [];
    if (readiness.base.status !== 'active' || readiness.base.deletedAt) blockedReasons.push('KNOWLEDGE_BASE_ARCHIVED');
    if (readiness.policy?.allowRuntimeRetrieval !== true) blockedReasons.push('RETRIEVAL_POLICY_BLOCKED');
    if (readiness.documentsReady === 0) blockedReasons.push('NO_INGESTED_DOCUMENTS');
    if (readiness.documentsReady > 0 && readiness.chunksReady === 0) blockedReasons.push('NO_CHUNKS_AVAILABLE');

    const keywordReady = blockedReasons.length === 0;
    const semanticReady = keywordReady && embeddings.status === 'ready' && readiness.embeddingsReady > 0;
    const effectiveRetrievalMode = !keywordReady
      ? 'none'
      : retrieval.mode === 'keyword'
        ? 'keyword'
        : semanticReady
          ? retrieval.mode
          : retrieval.mode === 'hybrid'
            ? 'keyword'
            : 'none';
    const ready = retrieval.mode === 'semantic' ? semanticReady : keywordReady;
    const status = ready
      ? retrieval.mode === 'hybrid' && !semanticReady ? 'degraded' : 'ready'
      : keywordReady ? 'degraded' : 'not_ready';
    const lastError = readiness.lastFailedDocument?.ingestionErrorMessage ?? readiness.lastJob?.errorMessage ?? null;

    return {
      knowledgeBaseId: readiness.base.id,
      status,
      ready,
      documentsTotal: readiness.documentsTotal,
      documentsReady: readiness.documentsReady,
      chunksReady: readiness.chunksReady,
      embeddingsReady: readiness.embeddingsReady,
      ingestionStatus: readiness.lastJob?.status ?? (readiness.documentsTotal > 0 ? 'pending' : 'empty'),
      retrievalMode: retrieval.mode,
      retrievalModeConfigured: retrieval.mode,
      effectiveRetrievalMode,
      keywordReady,
      semanticReady,
      blockedReasons,
      warnings: status === 'degraded'
        ? [{ code: semanticReady ? 'RAG_DEGRADED' : 'SEMANTIC_RETRIEVAL_NOT_READY', message: 'Retrieval keyword esta disponivel, mas retrieval semantico ainda nao esta pronto.' }]
        : [],
      lastError: lastError ? embeddingErrorMessage(lastError) : null,
      lastIngestionAt: readiness.lastJob?.completedAt?.toISOString()
        ?? readiness.lastJob?.createdAt.toISOString()
        ?? null,
      embeddings: {
        status: embeddings.status,
        enabled: embeddings.enabled,
        provider: embeddings.provider,
        model: embeddings.model,
        dimension: embeddings.dimension,
        failClosed: embeddings.failClosed,
      },
    };
  },

  async createKnowledgeBase(input: KnowledgeBaseCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const workspaceId = await resolveWorkspace(user, input.workspaceId, context, 'createKnowledgeBase');
    const ownerUserId = input.ownerUserId === null ? null : (input.ownerUserId ?? user.id);
    const base = await knowledgeRepository.createKnowledgeBase({
      ...input,
      tenantId: user.tenant.id,
      workspaceId,
      ownerUserId,
    });

    await audit({
      user,
      context,
      action: 'knowledge_base_created',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId,
      metadata: {
        status: base.status,
        visibility: base.visibility,
        dataClassification: base.dataClassification,
      },
    });

    return mapKnowledgeBase(base);
  },

  async updateKnowledgeBase(id: string, input: KnowledgeBaseUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.updateKnowledgeBase(id, user.tenant.id, userWorkspaceIds(user), input);
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_base_updated',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: current.workspaceId,
      metadata: {
        changedFields: Object.keys(input),
        status: base.status,
      },
    });

    return mapKnowledgeBase(base);
  },

  async updateKnowledgePolicy(id: string, input: KnowledgePolicyUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.updateKnowledgePolicy(id, user.tenant.id, userWorkspaceIds(user), input);
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_policy_updated',
      entity: 'knowledge_policy',
      entityId: base.policies?.[0]?.id ?? current.id,
      workspaceId: current.workspaceId,
      metadata: {
        knowledgeBaseId: current.id,
        changedFields: Object.keys(input),
        allowRuntimeRetrieval: base.policies?.[0]?.allowRuntimeRetrieval ?? false,
        allowCitationOnly: base.policies?.[0]?.allowCitationOnly ?? true,
        requireApprovalForExternal: base.policies?.[0]?.requireApprovalForExternal ?? true,
        rawContentLogged: false,
      },
    });

    return mapKnowledgeBase(base);
  },

  async archiveKnowledgeBase(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.archiveKnowledgeBase(id, user.tenant.id, userWorkspaceIds(user));
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_base_archived',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: current.workspaceId,
    });

    return mapKnowledgeBase(base);
  },

  async restoreKnowledgeBase(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getKnowledgeBaseOrThrow(id, user);
    const base = await knowledgeRepository.restoreKnowledgeBase(id, user.tenant.id, userWorkspaceIds(user));
    if (!base) {
      throw new AppError(404, 'KNOWLEDGE_BASE_NOT_FOUND', 'Base de conhecimento nao encontrada.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_base_restored',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: current.workspaceId,
    });

    return mapKnowledgeBase(base);
  },

  async listDocuments(knowledgeBaseId: string, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    const documents = await knowledgeRepository.listDocuments(base.id, user.tenant.id, userWorkspaceIds(user));
    return documents.map(mapKnowledgeDocument);
  },

  async createDocument(knowledgeBaseId: string, input: KnowledgeDocumentCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    if (base.status === 'archived' || base.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao aceita novos documentos.');
    }

    const document = await knowledgeRepository.createDocument({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: base.workspaceId,
      knowledgeBaseId: base.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'knowledge_document_created',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: base.workspaceId,
      metadata: {
        knowledgeBaseId: base.id,
        sourceType: document.sourceType,
        status: document.status,
        ingestionStatus: document.ingestionStatus,
      },
    });

    return mapKnowledgeDocument(document);
  },

  async uploadDocument(
    knowledgeBaseId: string,
    input: { body: Buffer; fileName: string; contentType?: string },
    user: AuthenticatedUser,
    context: RequestContext,
  ) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    if (base.status === 'archived' || base.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao aceita novos documentos.');
    }

    let parsed;
    try {
      parsed = parseKnowledgeUpload(input);
    } catch (error) {
      const code = error instanceof AppError ? error.code : 'KNOWLEDGE_UPLOAD_PARSE_FAILED';
      await audit({
        user,
        context,
        action: 'knowledge_document_upload_rejected',
        entity: 'knowledge_base',
        entityId: base.id,
        workspaceId: base.workspaceId,
        metadata: {
          knowledgeBaseId: base.id,
          errorCode: code,
          uploadBytes: Buffer.isBuffer(input.body) ? input.body.length : 0,
          contentType: input.contentType?.split(';', 1)[0],
          rawContentStored: false,
        },
      });
      if (error instanceof AppError) throw error;
      throw new AppError(422, code, 'Falha ao interpretar o arquivo enviado.');
    }

    const contentHash = hashText(parsed.contentText);
    const document = await knowledgeRepository.createDocument({
      tenantId: user.tenant.id,
      workspaceId: base.workspaceId,
      knowledgeBaseId: base.id,
      createdById: user.id,
      title: parsed.fileName,
      sourceType: 'file',
      mimeType: parsed.mimeType,
      status: 'draft',
      ingestionStatus: 'pending',
      dataClassification: base.dataClassification as KnowledgeDocumentCreateInput['dataClassification'],
      contentText: parsed.contentText,
      contentHash,
      metadata: {
        fileName: parsed.fileName,
        fileExtension: parsed.extension,
        fileSizeBytes: parsed.sizeBytes,
        size: formatKnowledgeUploadSize(parsed.sizeBytes),
        uploadMode: 'memory_utf8_text',
        rawFilePersisted: false,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_document_uploaded',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: base.workspaceId,
      metadata: {
        knowledgeBaseId: base.id,
        fileExtension: parsed.extension,
        mimeType: parsed.mimeType,
        uploadBytes: parsed.sizeBytes,
        rawContentLogged: false,
        rawFilePersisted: false,
      },
    });

    return mapKnowledgeDocument(document);
  },

  async getDocument(documentId: string, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    return mapKnowledgeDocument(document);
  },

  async updateDocument(documentId: string, input: KnowledgeDocumentUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const document = await knowledgeRepository.updateDocument(documentId, user.tenant.id, userWorkspaceIds(user), input);
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_document_updated',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: document.workspaceId,
      metadata: {
        knowledgeBaseId: current.knowledgeBaseId,
        changedFields: Object.keys(input),
        status: document.status,
        ingestionStatus: document.ingestionStatus,
      },
    });

    return mapKnowledgeDocument(document);
  },

  async archiveDocument(documentId: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const document = await knowledgeRepository.archiveDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_document_archived',
      entity: 'knowledge_document',
      entityId: document.id,
      workspaceId: document.workspaceId,
      metadata: { knowledgeBaseId: current.knowledgeBaseId },
    });

    return mapKnowledgeDocument(document);
  },

  async requestIngestion(documentId: string, input: KnowledgeIngestionRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    if (current.status === 'archived' || current.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_DOCUMENT_ARCHIVED', 'Documento arquivado nao pode ser ingerido.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_document_ingestion_requested',
      entity: 'knowledge_document',
      entityId: current.id,
      workspaceId: current.workspaceId,
      metadata: {
        knowledgeBaseId: current.knowledgeBaseId,
        sourceType: current.sourceType,
        strategy: 'local_text_chunking',
      },
    });

    const normalizedText = normalizeContentText(current.contentText ?? '');
    if (!normalizedText) {
      const errorCode = 'KNOWLEDGE_DOCUMENT_NO_CONTENT';
      const errorMessage = 'Documento nao possui conteudo textual simples para ingestao local.';
      const failed = await recordFailedIngestionJob({
        documentId: current.id,
        errorCode,
        errorMessage,
        user,
        metadata: { knowledgeBaseId: current.knowledgeBaseId, reason: 'empty_text' },
      });
      await audit({
        user,
        context,
        action: 'knowledge_ingestion_failed',
        entity: failed?.job ? 'knowledge_ingestion_job' : 'knowledge_document',
        entityId: failed?.job.id ?? current.id,
        workspaceId: current.workspaceId,
        metadata: {
          knowledgeBaseId: current.knowledgeBaseId,
          documentId: current.id,
          errorCode,
          jobId: failed?.job.id,
          status: failed?.job.status ?? 'failed',
        },
      });
      throw new AppError(422, errorCode, errorMessage);
    }

    let chunks;
    try {
      chunks = chunkContentText(normalizedText);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const maxDocumentChars = localChunkingDefaults.maxDocumentChars;
      const errorCode = message.startsWith('DOCUMENT_TEXT_TOO_LARGE') ? 'DOCUMENT_TEXT_TOO_LARGE' : 'LOCAL_CHUNKING_FAILED';
      const errorMessage = errorCode === 'DOCUMENT_TEXT_TOO_LARGE'
        ? `Conteudo textual excede o limite de ${maxDocumentChars} caracteres.`
        : 'Falha no chunking textual local.';
      const failed = await recordFailedIngestionJob({
        documentId: current.id,
        errorCode,
        errorMessage,
        user,
        metadata: { knowledgeBaseId: current.knowledgeBaseId, maxDocumentChars },
      });
      await audit({
        user,
        context,
        action: 'knowledge_ingestion_failed',
        entity: failed?.job ? 'knowledge_ingestion_job' : 'knowledge_document',
        entityId: failed?.job.id ?? current.id,
        workspaceId: current.workspaceId,
        metadata: {
          knowledgeBaseId: current.knowledgeBaseId,
          documentId: current.id,
          errorCode,
          jobId: failed?.job.id,
          status: failed?.job.status ?? 'failed',
          maxDocumentChars,
        },
      });
      throw new AppError(422, errorCode, errorMessage);
    }

    if (chunks.length === 0) {
      const errorCode = 'KNOWLEDGE_DOCUMENT_NO_CHUNKS';
      const errorMessage = 'Conteudo textual nao gerou chunks validos.';
      const failed = await recordFailedIngestionJob({
        documentId: current.id,
        errorCode,
        errorMessage,
        user,
        metadata: { knowledgeBaseId: current.knowledgeBaseId, reason: 'no_chunks' },
      });
      await audit({
        user,
        context,
        action: 'knowledge_ingestion_failed',
        entity: failed?.job ? 'knowledge_ingestion_job' : 'knowledge_document',
        entityId: failed?.job.id ?? current.id,
        workspaceId: current.workspaceId,
        metadata: {
          knowledgeBaseId: current.knowledgeBaseId,
          documentId: current.id,
          errorCode,
          jobId: failed?.job.id,
          status: failed?.job.status ?? 'failed',
        },
      });
      throw new AppError(422, errorCode, errorMessage);
    }

    const sourceReferences = chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      label: `${current.title} #${chunk.chunkIndex + 1}`,
      sourceType: current.sourceType,
      sourceUri: sourceUriForDocument(current),
      sectionTitle: chunk.sectionTitle,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      metadata: {
        strategy: 'local_text_chunking',
      } as Prisma.InputJsonValue,
    }));

    const result = await knowledgeRepository.requestIngestion({
      documentId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      createdById: user.id,
      contentHash: hashText(normalizedText),
      chunks,
      sourceReferences,
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        strategy: 'local_text_chunking',
        chunkSizeChars: localChunkingDefaults.chunkSizeChars,
        chunkOverlapChars: localChunkingDefaults.chunkOverlapChars,
        requestedById: user.id,
      }) as Prisma.InputJsonValue,
    });
    if (!result) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const chunksCreated = result.chunksCreated ?? result.chunks.length;
    const sourceReferencesCreated = result.sourceReferencesCreated ?? result.sourceReferences.length;
    const idempotent = result.idempotent ?? false;

    await audit({
      user,
      context,
      action: 'knowledge_ingestion_requested',
      entity: 'knowledge_ingestion_job',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        status: result.job.status,
        strategy: result.job.strategy,
        idempotent,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_ingestion_started',
      entity: 'knowledge_ingestion_job',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        strategy: result.job.strategy,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_chunks_created',
      entity: 'knowledge_chunk',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        chunksCreated,
        idempotent,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_source_references_created',
      entity: 'knowledge_source_reference',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        sourceReferencesCreated,
        idempotent,
      },
    });

    await audit({
      user,
      context,
      action: 'knowledge_ingestion_completed',
      entity: 'knowledge_ingestion_job',
      entityId: result.job.id,
      workspaceId: result.job.workspaceId,
      metadata: {
        knowledgeBaseId: result.job.knowledgeBaseId,
        documentId: result.job.documentId,
        chunksCreated,
        sourceReferencesCreated,
        idempotent,
      },
    });

    return {
      document: mapKnowledgeDocument(result.document),
      job: mapKnowledgeIngestionJob(result.job),
      chunksCreated,
      sourceReferencesCreated,
      idempotent,
    };
  },

  async requestDocumentEmbeddings(documentId: string, input: KnowledgeEmbeddingRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    if (current.status === 'archived' || current.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_DOCUMENT_ARCHIVED', 'Documento arquivado nao pode receber embeddings.');
    }
    if (current.ingestionStatus !== 'completed') {
      throw new AppError(409, 'KNOWLEDGE_DOCUMENT_NOT_INGESTED', 'Documento precisa estar com ingestao concluida para receber embeddings.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_embeddings_requested',
      entity: 'knowledge_document',
      entityId: current.id,
      workspaceId: current.workspaceId,
      metadata: {
        scope: 'document',
        knowledgeBaseId: current.knowledgeBaseId,
        limit: input.limit,
        force: input.force,
        requestedChunkIds: input.chunkIds?.length ?? 0,
      },
    });

    try {
      const chunks = await knowledgeRepository.listDocumentChunksForEmbedding(current.id, user.tenant.id, userWorkspaceIds(user), {
        limit: input.limit,
        chunkIds: input.chunkIds,
      });
      const summary = await processEmbeddingChunks({
        scope: 'document',
        scopeId: current.id,
        chunks,
        request: input,
        user,
        context,
      });

      await audit({
        user,
        context,
        action: summary.status === 'failed' ? 'knowledge_embeddings_failed' : 'knowledge_embeddings_completed',
        entity: 'knowledge_document',
        entityId: current.id,
        workspaceId: current.workspaceId,
        metadata: {
          ...summary,
          failures: summary.failures.map((failure) => ({ chunkId: failure.chunkId, code: failure.code })),
        },
      });

      return summary;
    } catch (error) {
      await audit({
        user,
        context,
        action: 'knowledge_embeddings_failed',
        entity: 'knowledge_document',
        entityId: current.id,
        workspaceId: current.workspaceId,
        metadata: {
          scope: 'document',
          scopeId: current.id,
          knowledgeBaseId: current.knowledgeBaseId,
          errorCode: embeddingErrorCode(error),
        },
      });
      throw error;
    }
  },

  async requestKnowledgeBaseEmbeddings(knowledgeBaseId: string, input: KnowledgeEmbeddingRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    if (base.status === 'archived' || base.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao pode receber embeddings.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_embeddings_requested',
      entity: 'knowledge_base',
      entityId: base.id,
      workspaceId: base.workspaceId,
      metadata: {
        scope: 'knowledge_base',
        limit: input.limit,
        force: input.force,
        requestedChunkIds: input.chunkIds?.length ?? 0,
      },
    });

    try {
      const chunks = await knowledgeRepository.listKnowledgeBaseChunksForEmbedding(base.id, user.tenant.id, userWorkspaceIds(user), {
        limit: input.limit,
        chunkIds: input.chunkIds,
      });
      const summary = await processEmbeddingChunks({
        scope: 'knowledge_base',
        scopeId: base.id,
        chunks,
        request: input,
        user,
        context,
      });

      await audit({
        user,
        context,
        action: summary.status === 'failed' ? 'knowledge_embeddings_failed' : 'knowledge_embeddings_completed',
        entity: 'knowledge_base',
        entityId: base.id,
        workspaceId: base.workspaceId,
        metadata: {
          ...summary,
          failures: summary.failures.map((failure) => ({ chunkId: failure.chunkId, code: failure.code })),
        },
      });

      return summary;
    } catch (error) {
      await audit({
        user,
        context,
        action: 'knowledge_embeddings_failed',
        entity: 'knowledge_base',
        entityId: base.id,
        workspaceId: base.workspaceId,
        metadata: {
          scope: 'knowledge_base',
          scopeId: base.id,
          errorCode: embeddingErrorCode(error),
        },
      });
      throw error;
    }
  },

  async listIngestionJobs(documentId: string, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const jobs = await knowledgeRepository.listIngestionJobs(document.id, user.tenant.id, userWorkspaceIds(user));
    return jobs.map(mapKnowledgeIngestionJob);
  },

  async getIngestionJob(jobId: string, user: AuthenticatedUser) {
    const job = await knowledgeRepository.findIngestionJob(jobId, user.tenant.id, userWorkspaceIds(user));
    if (!job) {
      throw new AppError(404, 'KNOWLEDGE_INGESTION_JOB_NOT_FOUND', 'Job de ingestao nao encontrado.');
    }
    return {
      ...mapKnowledgeIngestionJob(job),
      events: job.events.map(mapKnowledgeIngestionEvent),
    };
  },

  async listDocumentChunks(documentId: string, query: KnowledgeChunksQuery, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const result = await knowledgeRepository.listDocumentChunks(document.id, user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapKnowledgeChunk),
      pagination: paginationMeta(query, result.total),
    };
  },

  async listKnowledgeBaseChunks(knowledgeBaseId: string, query: KnowledgeChunksQuery, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    const result = await knowledgeRepository.listKnowledgeBaseChunks(base.id, user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapKnowledgeChunk),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getChunk(chunkId: string, user: AuthenticatedUser) {
    const chunk = await knowledgeRepository.findChunk(chunkId, user.tenant.id, userWorkspaceIds(user));
    if (!chunk) {
      throw new AppError(404, 'KNOWLEDGE_CHUNK_NOT_FOUND', 'Chunk de conhecimento nao encontrado.');
    }
    return mapKnowledgeChunk(chunk);
  },

  async listDocumentSourceReferences(documentId: string, user: AuthenticatedUser) {
    const document = await knowledgeRepository.findDocument(documentId, user.tenant.id, userWorkspaceIds(user));
    if (!document) {
      throw new AppError(404, 'KNOWLEDGE_DOCUMENT_NOT_FOUND', 'Documento de conhecimento nao encontrado.');
    }
    const references = await knowledgeRepository.listDocumentSourceReferences(document.id, user.tenant.id, userWorkspaceIds(user));
    return references.map(mapKnowledgeSourceReference);
  },

  async listChunkSourceReferences(chunkId: string, user: AuthenticatedUser) {
    const chunk = await knowledgeRepository.findChunk(chunkId, user.tenant.id, userWorkspaceIds(user));
    if (!chunk) {
      throw new AppError(404, 'KNOWLEDGE_CHUNK_NOT_FOUND', 'Chunk de conhecimento nao encontrado.');
    }
    const references = await knowledgeRepository.listChunkSourceReferences(chunk.id, user.tenant.id, userWorkspaceIds(user));
    return references.map(mapKnowledgeSourceReference);
  },

  async getRagReadiness(assistantId: string, user: AuthenticatedUser, context: RequestContext) {
    const readiness = await knowledgeRepository.getRagReadiness(assistantId, user.tenant.id, userWorkspaceIds(user));
    if (!readiness) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    const response = mapReadiness(readiness)!;

    await audit({
      user,
      context,
      action: 'rag_readiness_checked',
      entity: 'assistant',
      entityId: readiness.assistant.id,
      workspaceId: readiness.assistant.workspaceId,
      metadata: {
        knowledgeBasesBound: readiness.knowledgeBasesBound,
        documentsIngested: readiness.documentsIngested,
        chunksAvailable: readiness.chunksAvailable,
        sourceReferenceCount: readiness.sourceReferenceCount,
        ready: response.ready,
        blockedReasons: readiness.blockedReasons,
        embeddingsEnabled: response.embeddingsEnabled,
        embeddingStatus: response.embeddings.status,
        embeddingProvider: response.embeddings.provider,
        embeddingFailClosed: response.embeddings.failClosed,
        vectorStoreEnabled: response.vectorStoreEnabled,
      },
    });

    return response;
  },

  async localSearch(assistantId: string, input: RagLocalSearchInput, user: AuthenticatedUser, context: RequestContext) {
    const result = await knowledgeRepository.localSearch(assistantId, user.tenant.id, userWorkspaceIds(user), input.query);
    if (!result) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'rag_local_search_executed',
      entity: 'assistant',
      entityId: result.readiness.assistant.id,
      workspaceId: result.readiness.assistant.workspaceId,
      metadata: {
        mode: 'keyword_local_placeholder',
        queryLength: input.query.length,
        results: result.chunks.length,
      },
    });

    return {
      mode: 'keyword_local_placeholder',
      retrievalMode: 'local_chunks_only',
      embeddingsEnabled: false,
      vectorStoreEnabled: false,
      results: result.chunks.map((chunk) => {
        const reference = chunk.sourceReferences[0];
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          knowledgeBaseId: chunk.knowledgeBaseId,
          score: localSearchScore(chunk.content, input.query),
          snippet: localSearchSnippet(chunk.content, input.query),
          source: reference
            ? {
                label: reference.label,
                sourceUri: reference.sourceUri,
                sectionTitle: reference.sectionTitle,
              }
            : null,
        };
      }),
    };
  },

  async semanticSearch(assistantId: string, input: RagSemanticSearchInput, user: AuthenticatedUser, context: RequestContext) {
    const workspaceIds = userWorkspaceIds(user);
    const normalizedTerms = ragTerms(input.query);
    const ragReadiness = await knowledgeRepository.getRagReadiness(assistantId, user.tenant.id, workspaceIds);
    if (!ragReadiness) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    const readiness = mapReadiness(ragReadiness)!;
    const embeddingReadiness = embeddingsService.getEmbeddingReadiness();
    const provider = embeddingReadiness.model && embeddingReadiness.dimension ? embeddingReadiness.provider : null;
    const model = embeddingReadiness.model;
    const dimension = embeddingReadiness.dimension;

    const baseResponse = {
      assistantId: ragReadiness.assistant.id,
      provider,
      model,
      dimension,
    };

    await audit({
      user,
      context,
      action: 'rag_semantic_search_requested',
      entity: 'assistant',
      entityId: ragReadiness.assistant.id,
      workspaceId: ragReadiness.assistant.workspaceId,
      metadata: {
        assistantId: ragReadiness.assistant.id,
        queryLength: input.query.length,
        limit: input.limit,
        fallback: input.fallback,
        embeddingStatus: embeddingReadiness.status,
        provider,
        model,
        dimension,
        requestId: context.requestId,
      },
    });

    const fallback = async (reason: SemanticFallbackReason) => {
      if (!input.fallback) {
        const response = {
          ...baseResponse,
          status: reason === 'RAG_NOT_READY' || reason === 'EMBEDDINGS_NOT_READY' ? 'blocked' : 'no_results',
          retrievalMode: 'semantic_vector',
          semanticEnabled: embeddingReadiness.status === 'ready',
          vectorStoreUsed: false,
          fallbackUsed: false,
          fallbackReason: reason,
          resultCount: 0,
          results: [],
        };
        await audit({
          user,
          context,
          action: reason === 'SEMANTIC_RETRIEVAL_FAILED' ? 'rag_semantic_search_failed' : 'rag_semantic_search_completed',
          entity: 'assistant',
          entityId: ragReadiness.assistant.id,
          workspaceId: ragReadiness.assistant.workspaceId,
          metadata: {
            assistantId: ragReadiness.assistant.id,
            retrievalMode: response.retrievalMode,
            fallbackReason: reason,
            fallbackUsed: false,
            resultCount: 0,
            requestId: context.requestId,
          },
        });
        return response;
      }

      const lexicalResult = await knowledgeRepository.findRagRetrievalCandidates({
        assistantId,
        tenantId: user.tenant.id,
        workspaceIds,
        queryText: input.query,
        terms: originalSearchTerms(input.query),
        take: Math.max(40, input.limit * 20),
      });
      if (!lexicalResult) {
        throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
      }
      const priorityByKnowledgeBaseId = new Map(
        lexicalResult.readiness.activeBindings.map((binding) => [binding.knowledgeBaseId, binding.priority]),
      );
      const results = mapLexicalFallbackResults({
        chunks: lexicalResult.chunks,
        normalizedTerms,
        priorityByKnowledgeBaseId,
        limit: input.limit,
      });
      await audit({
        user,
        context,
        action: 'rag_semantic_search_fallback',
        entity: 'assistant',
        entityId: ragReadiness.assistant.id,
        workspaceId: ragReadiness.assistant.workspaceId,
        metadata: {
          assistantId: ragReadiness.assistant.id,
          fallbackReason: reason,
          resultCount: results.length,
          requestId: context.requestId,
        },
      });
      const response = {
        ...baseResponse,
        status: results.length > 0 ? 'completed' : 'no_results',
        retrievalMode: 'fallback_local_keyword',
        semanticEnabled: embeddingReadiness.status === 'ready',
        vectorStoreUsed: false,
        fallbackUsed: true,
        fallbackReason: reason,
        resultCount: results.length,
        results,
      };
      await audit({
        user,
        context,
        action: 'rag_semantic_search_completed',
        entity: 'assistant',
        entityId: ragReadiness.assistant.id,
        workspaceId: ragReadiness.assistant.workspaceId,
        metadata: {
          assistantId: ragReadiness.assistant.id,
          retrievalMode: response.retrievalMode,
          fallbackReason: reason,
          fallbackUsed: true,
          resultCount: results.length,
          requestId: context.requestId,
        },
      });
      return response;
    };

    if (!readiness.ready) {
      return fallback('RAG_NOT_READY');
    }
    if (embeddingReadiness.status !== 'ready' || !model || !dimension) {
      return fallback('EMBEDDINGS_NOT_READY');
    }

    try {
      const queryEmbedding = await embeddingsService.embedText({
        text: input.query,
        requestId: context.requestId,
        model,
        metadata: {
          scope: 'rag_semantic_search',
          assistantId: ragReadiness.assistant.id,
          rawInputStored: false,
          rawOutputStored: false,
        },
      });
      if (!Array.isArray(queryEmbedding.vector) || queryEmbedding.vector.length !== dimension || !queryEmbedding.vector.every(Number.isFinite)) {
        throw new AppError(502, 'EMBEDDING_DIMENSION_MISMATCH', 'Embedding provider returned a vector with unexpected dimension.');
      }

      const semanticResult = await knowledgeRepository.findSemanticRagRetrievalCandidates({
        assistantId,
        tenantId: user.tenant.id,
        workspaceIds,
        queryVector: queryEmbedding.vector,
        provider: embeddingReadiness.provider,
        model,
        dimension,
        take: input.limit,
      });
      if (!semanticResult) {
        throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
      }
      if (semanticResult.chunks.length === 0) {
        return fallback(semanticResult.semanticCandidateCount === 0 ? 'NO_SEMANTIC_EMBEDDINGS' : 'SEMANTIC_NO_RESULTS');
      }

      const results = mapSemanticSearchResults(semanticResult.chunks, normalizedTerms);
      const response = {
        ...baseResponse,
        status: 'completed',
        retrievalMode: 'semantic_vector',
        semanticEnabled: true,
        vectorStoreUsed: true,
        fallbackUsed: false,
        fallbackReason: null,
        resultCount: results.length,
        results,
      };
      await audit({
        user,
        context,
        action: 'rag_semantic_search_completed',
        entity: 'assistant',
        entityId: ragReadiness.assistant.id,
        workspaceId: ragReadiness.assistant.workspaceId,
        metadata: {
          assistantId: ragReadiness.assistant.id,
          retrievalMode: response.retrievalMode,
          vectorStoreUsed: true,
          resultCount: results.length,
          provider: embeddingReadiness.provider,
          model,
          dimension,
          requestId: context.requestId,
        },
      });
      return response;
    } catch (error) {
      if (error instanceof AppError && error.status === 404) {
        throw error;
      }
      return fallback('SEMANTIC_RETRIEVAL_FAILED');
    }
  },

  async queryRag(assistantId: string, input: RagQueryRequestInput, user: AuthenticatedUser, context: RequestContext) {
    const normalizedQuery = normalizeRagQuery(input.query);
    const normalizedTerms = ragTerms(input.query);
    const retrievalConfig = getKnowledgeRetrievalConfig();
    const retrievalLimit = Math.min(input.limit, retrievalConfig.maxTopK);

    try {
      const result = await knowledgeRepository.findRagRetrievalCandidates({
        assistantId,
        tenantId: user.tenant.id,
        workspaceIds: userWorkspaceIds(user),
        queryText: input.query,
        terms: originalSearchTerms(input.query),
        take: Math.max(40, retrievalLimit * 20),
      });
      if (!result) {
        throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
      }

      const readiness = mapReadiness(result.readiness)!;
      const embeddingReadiness = readiness.embeddings;
      const embeddingMetadata = embeddingReadinessMetadata(embeddingReadiness);
      const warnings = [...readiness.warnings];
      if (input.includeArchived) {
        warnings.push({
          code: 'ARCHIVED_CONTENT_EXCLUDED',
          message: 'Conteudo arquivado permanece fora do escopo da consulta local.',
        });
      }

      await audit({
        user,
        context,
        action: 'rag_query_requested',
        entity: 'assistant',
        entityId: result.readiness.assistant.id,
        workspaceId: result.readiness.assistant.workspaceId,
        metadata: {
          assistantId: result.readiness.assistant.id,
          queryLength: input.query.length,
          requestedLimit: input.limit,
          effectiveLimit: retrievalLimit,
          mode: retrievalConfig.mode,
          retrievalMode: retrievalConfig.mode,
          keywordUsed: false,
          semanticEnabled: embeddingReadiness.status === 'ready',
          semanticUsed: false,
          hybridMergeApplied: false,
          stubKeywordPriority: false,
          vectorStoreUsed: false,
          fallbackUsed: false,
          provider: embeddingMetadata.provider,
          model: embeddingMetadata.model,
          dimension: embeddingMetadata.dimension,
          requestId: context.requestId,
        },
      });

      if (!readiness.ready) {
        const blockedReason = readiness.blockedReasons[0] ?? 'RAG_NOT_READY';
        const persisted = await knowledgeRepository.createRagQueryWithResults({
          tenantId: user.tenant.id,
          workspaceId: result.readiness.assistant.workspaceId,
          assistantId: result.readiness.assistant.id,
          assistantVersionId: input.assistantVersionId,
          agentRunId: input.agentRunId,
          queryText: input.query,
          normalizedQuery,
          mode: 'local_readiness',
          status: 'blocked',
          limit: retrievalLimit,
          resultCount: 0,
          blockedReason,
          errorCode: 'RAG_NOT_READY',
          errorMessage: 'O assistente nao possui fontes de conhecimento prontas para consulta.',
          createdById: user.id,
          requestId: context.requestId,
          traceId: input.traceId,
          metadata: sanitizeMetadata({
            readiness,
            retrievalMode: 'local_readiness',
            keywordUsed: false,
            semanticEnabled: embeddingReadiness.status === 'ready',
            semanticUsed: false,
            hybridMergeApplied: false,
            stubKeywordPriority: false,
            vectorStoreUsed: false,
            fallbackUsed: false,
            fallbackReason: 'RAG_NOT_READY',
            provider: embeddingMetadata.provider,
            model: embeddingMetadata.model,
            dimension: embeddingMetadata.dimension,
            queryLength: input.query.length,
            includeArchived: input.includeArchived,
          }) as Prisma.InputJsonValue,
          results: [],
        });

        await audit({
          user,
          context,
          action: 'rag_query_blocked',
          entity: 'rag_query',
          entityId: persisted.id,
          workspaceId: result.readiness.assistant.workspaceId,
          metadata: {
            queryId: persisted.id,
            assistantId: result.readiness.assistant.id,
            status: 'blocked',
            blockedReason,
            retrievalMode: 'local_readiness',
            keywordUsed: false,
            semanticEnabled: embeddingReadiness.status === 'ready',
            semanticUsed: false,
            hybridMergeApplied: false,
            stubKeywordPriority: false,
            vectorStoreUsed: false,
            fallbackUsed: false,
            fallbackReason: 'RAG_NOT_READY',
            requestId: context.requestId,
          },
        });

        return {
          queryId: persisted.id,
          assistantId: result.readiness.assistant.id,
          status: 'blocked',
          code: 'RAG_NOT_READY',
          message: 'O assistente nao possui fontes de conhecimento prontas para consulta.',
          reasons: readiness.blockedReasons,
          readiness,
          resultCount: 0,
          sources: [],
          warnings,
          retrievalMode: 'local_readiness',
          keywordUsed: false,
          semanticEnabled: embeddingReadiness.status === 'ready',
          semanticUsed: false,
          hybridMergeApplied: false,
          stubKeywordPriority: false,
          vectorStoreUsed: false,
          fallbackUsed: false,
          fallbackReason: 'RAG_NOT_READY',
          provider: embeddingMetadata.provider,
          model: embeddingMetadata.model,
          dimension: embeddingMetadata.dimension,
        };
      }

      const retrieval = await resolveOfficialRagRetrieval({
        assistantId,
        tenantId: user.tenant.id,
        workspaceIds: userWorkspaceIds(user),
        query: input.query,
        limit: retrievalLimit,
        normalizedTerms,
        requestId: context.requestId,
        embeddingReadiness,
        lexicalResult: result,
      });
      const selectedResults = retrieval.selectedResults;
      if (retrieval.fallbackUsed) {
        warnings.push({
          code: retrieval.fallbackReason ?? 'SEMANTIC_FALLBACK_USED',
          message: 'Retrieval semantico indisponivel; fallback keyword governado aplicado.',
        });
      }

      const status = selectedResults.length > 0 ? 'completed' : 'no_results';
      if (status === 'no_results') {
        warnings.push({
          code: 'NO_RELEVANT_CHUNKS_FOUND',
          message: 'Nenhum trecho local foi encontrado para esta consulta.',
        });
      }

      const persisted = await knowledgeRepository.createRagQueryWithResults({
        tenantId: user.tenant.id,
        workspaceId: result.readiness.assistant.workspaceId,
        assistantId: result.readiness.assistant.id,
        assistantVersionId: input.assistantVersionId,
        agentRunId: input.agentRunId,
        queryText: input.query,
        normalizedQuery,
        mode: retrieval.mode,
        status,
        limit: retrievalLimit,
        resultCount: selectedResults.length,
        createdById: user.id,
        requestId: context.requestId,
        traceId: input.traceId,
        metadata: sanitizeMetadata({
          retrievalMode: retrieval.retrievalMode,
          keywordUsed: retrieval.keywordUsed,
          semanticEnabled: retrieval.semanticEnabled,
          semanticUsed: retrieval.semanticUsed,
          hybridMergeApplied: retrieval.hybridMergeApplied,
          stubKeywordPriority: retrieval.stubKeywordPriority,
          vectorStoreUsed: retrieval.vectorStoreUsed,
          fallbackUsed: retrieval.fallbackUsed,
          fallbackReason: retrieval.fallbackReason,
          provider: retrieval.provider,
          model: retrieval.model,
          dimension: retrieval.dimension,
          queryLength: input.query.length,
          includeArchived: input.includeArchived,
          terms: normalizedTerms,
          selectedSources: selectedResults.map((item) => ({
            rank: item.rank,
            documentId: item.documentId,
            chunkId: item.chunkId,
            matchType: item.matchType,
            score: item.score,
            documentTitle: metadataRecord(item.metadata).documentTitle,
            sourceReferenceLabel: metadataRecord(item.metadata).sourceReferenceLabel,
          })),
        }) as Prisma.InputJsonValue,
        results: selectedResults,
      });

      const mapped = mapRagQuery(persisted);
      await audit({
        user,
        context,
        action: status === 'completed' ? 'rag_query_completed' : 'rag_query_no_results',
        entity: 'rag_query',
        entityId: persisted.id,
        workspaceId: result.readiness.assistant.workspaceId,
        metadata: {
          queryId: persisted.id,
          assistantId: result.readiness.assistant.id,
          knowledgeBaseIds: Array.from(new Set(selectedResults.map((item) => item.knowledgeBaseId))),
          documentIds: Array.from(new Set(selectedResults.map((item) => item.documentId))),
          resultCount: selectedResults.length,
          status,
          retrievalMode: retrieval.retrievalMode,
          keywordUsed: retrieval.keywordUsed,
          semanticEnabled: retrieval.semanticEnabled,
          semanticUsed: retrieval.semanticUsed,
          hybridMergeApplied: retrieval.hybridMergeApplied,
          stubKeywordPriority: retrieval.stubKeywordPriority,
          vectorStoreUsed: retrieval.vectorStoreUsed,
          fallbackUsed: retrieval.fallbackUsed,
          fallbackReason: retrieval.fallbackReason,
          provider: retrieval.provider,
          model: retrieval.model,
          dimension: retrieval.dimension,
          selectedSourceCount: selectedResults.length,
          resultTitles: selectedResults.map((item) => metadataRecord(item.metadata).documentTitle).filter(Boolean),
          resultLabels: selectedResults.map((item) => metadataRecord(item.metadata).sourceReferenceLabel).filter(Boolean),
          matchTypes: selectedResults.map((item) => item.matchType),
          ranks: selectedResults.map((item) => item.rank),
          requestId: context.requestId,
        },
      });

      if (selectedResults.length > 0) {
        await audit({
          user,
          context,
          action: 'rag_source_returned',
          entity: 'rag_query',
          entityId: persisted.id,
          workspaceId: result.readiness.assistant.workspaceId,
          metadata: {
            queryId: persisted.id,
            assistantId: result.readiness.assistant.id,
            resultCount: selectedResults.length,
            documentIds: Array.from(new Set(selectedResults.map((item) => item.documentId))),
            retrievalMode: retrieval.retrievalMode,
            keywordUsed: retrieval.keywordUsed,
            semanticEnabled: retrieval.semanticEnabled,
            semanticUsed: retrieval.semanticUsed,
            hybridMergeApplied: retrieval.hybridMergeApplied,
            stubKeywordPriority: retrieval.stubKeywordPriority,
            vectorStoreUsed: retrieval.vectorStoreUsed,
            fallbackUsed: retrieval.fallbackUsed,
            fallbackReason: retrieval.fallbackReason,
          },
        });
      }

      return {
        queryId: mapped.queryId,
        assistantId: mapped.assistantId,
        status: mapped.status,
        query: mapped.query,
        resultCount: mapped.resultCount,
        sources: mapped.sources,
        warnings,
        retrievalMode: retrieval.retrievalMode,
        keywordUsed: retrieval.keywordUsed,
        semanticEnabled: retrieval.semanticEnabled,
        semanticUsed: retrieval.semanticUsed,
        hybridMergeApplied: retrieval.hybridMergeApplied,
        stubKeywordPriority: retrieval.stubKeywordPriority,
        vectorStoreUsed: retrieval.vectorStoreUsed,
        fallbackUsed: retrieval.fallbackUsed,
        fallbackReason: retrieval.fallbackReason,
        provider: retrieval.provider,
        model: retrieval.model,
        dimension: retrieval.dimension,
      };
    } catch (error) {
      if (!(error instanceof AppError && error.status === 404)) {
        await audit({
          user,
          context,
          action: 'rag_query_failed',
          entity: 'assistant',
          entityId: assistantId,
          metadata: {
            assistantId,
            queryLength: input.query.length,
            errorCode: embeddingErrorCode(error),
            requestId: context.requestId,
          },
        });
      }
      throw error;
    }
  },

  async linkRagQueryToAgentRun(queryId: string, agentRunId: string, user: AuthenticatedUser, context: RequestContext) {
    const linked = await knowledgeRepository.linkRagQueryToAgentRun({
      queryId,
      agentRunId,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
    });
    if (!linked) return null;

    await audit({
      user,
      context,
      action: 'rag_query_agent_run_linked',
      entity: 'rag_query',
      entityId: queryId,
      metadata: {
        queryId,
        agentRunId,
        rawContentLogged: false,
      },
    });
    return linked;
  },

  async listRagQueries(assistantId: string, query: RagQueriesQuery, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const result = await knowledgeRepository.listRagQueries(assistant.id, user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapRagQuery),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getRagQuery(queryId: string, user: AuthenticatedUser) {
    const query = await knowledgeRepository.findRagQuery(queryId, user.tenant.id, userWorkspaceIds(user));
    if (!query) {
      throw new AppError(404, 'RAG_QUERY_NOT_FOUND', 'Consulta RAG nao encontrada.');
    }
    return mapRagQuery(query);
  },

  async listRagQuerySources(queryId: string, user: AuthenticatedUser) {
    const results = await knowledgeRepository.listRagQueryResults(queryId, user.tenant.id, userWorkspaceIds(user));
    if (!results) {
      throw new AppError(404, 'RAG_QUERY_NOT_FOUND', 'Consulta RAG nao encontrada.');
    }
    return results.map(mapRagQuerySource);
  },

  async listDataSources(knowledgeBaseId: string, user: AuthenticatedUser) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    const dataSources = await knowledgeRepository.listDataSources(base.id, user.tenant.id, userWorkspaceIds(user));
    return dataSources.map(mapKnowledgeDataSource);
  },

  async createDataSource(knowledgeBaseId: string, input: KnowledgeDataSourceCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const base = await getKnowledgeBaseOrThrow(knowledgeBaseId, user);
    if (base.status === 'archived' || base.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao aceita novos data sources.');
    }

    const dataSource = await knowledgeRepository.createDataSource({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: base.workspaceId,
      knowledgeBaseId: base.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'knowledge_data_source_created',
      entity: 'knowledge_data_source',
      entityId: dataSource.id,
      workspaceId: base.workspaceId,
      metadata: {
        knowledgeBaseId: base.id,
        type: dataSource.type,
        status: dataSource.status,
      },
    });

    return mapKnowledgeDataSource(dataSource);
  },

  async updateDataSource(dataSourceId: string, input: KnowledgeDataSourceUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const dataSource = await knowledgeRepository.updateDataSource(dataSourceId, user.tenant.id, userWorkspaceIds(user), input);
    if (!dataSource) {
      throw new AppError(404, 'KNOWLEDGE_DATA_SOURCE_NOT_FOUND', 'Data source de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_data_source_updated',
      entity: 'knowledge_data_source',
      entityId: dataSource.id,
      workspaceId: dataSource.workspaceId,
      metadata: {
        knowledgeBaseId: dataSource.knowledgeBaseId,
        changedFields: Object.keys(input),
        status: dataSource.status,
      },
    });

    return mapKnowledgeDataSource(dataSource);
  },

  async archiveDataSource(dataSourceId: string, user: AuthenticatedUser, context: RequestContext) {
    const dataSource = await knowledgeRepository.archiveDataSource(dataSourceId, user.tenant.id, userWorkspaceIds(user));
    if (!dataSource) {
      throw new AppError(404, 'KNOWLEDGE_DATA_SOURCE_NOT_FOUND', 'Data source de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_data_source_updated',
      entity: 'knowledge_data_source',
      entityId: dataSource.id,
      workspaceId: dataSource.workspaceId,
      metadata: {
        knowledgeBaseId: dataSource.knowledgeBaseId,
        status: dataSource.status,
      },
    });

    return mapKnowledgeDataSource(dataSource);
  },

  async listBindings(assistantId: string, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const bindings = await knowledgeRepository.listBindings(assistant.id, user.tenant.id, userWorkspaceIds(user));
    return bindings.map(mapAssistantKnowledgeBinding);
  },

  async createBinding(assistantId: string, input: AssistantKnowledgeBindingCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const knowledgeBase = await getKnowledgeBaseOrThrow(input.knowledgeBaseId, user);
    if (knowledgeBase.status === 'archived' || knowledgeBase.deletedAt) {
      throw new AppError(409, 'KNOWLEDGE_BASE_ARCHIVED', 'Base arquivada nao pode ser vinculada.');
    }
    if (assistant.workspaceId !== knowledgeBase.workspaceId) {
      await recordDenied(user, context, assistant.workspaceId, 'knowledgeBindingWorkspaceScope');
      throw new AppError(403, 'WORKSPACE_SCOPE_MISMATCH', 'Base de conhecimento e assistente devem pertencer ao mesmo workspace.');
    }

    const binding = await knowledgeRepository.createBinding({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      createdById: user.id,
    });

    await audit({
      user,
      context,
      action: 'knowledge_binding_created',
      entity: 'assistant_knowledge_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        knowledgeBaseId: input.knowledgeBaseId,
        retrievalMode: binding.retrievalMode,
        isEnabled: binding.isEnabled,
      },
    });

    return mapAssistantKnowledgeBinding(binding);
  },

  async updateBinding(
    assistantId: string,
    bindingId: string,
    input: AssistantKnowledgeBindingUpdateInput,
    user: AuthenticatedUser,
    context: RequestContext,
  ) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const binding = await knowledgeRepository.updateBinding(assistant.id, bindingId, user.tenant.id, userWorkspaceIds(user), input);
    if (!binding) {
      throw new AppError(404, 'KNOWLEDGE_BINDING_NOT_FOUND', 'Binding de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_binding_updated',
      entity: 'assistant_knowledge_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        knowledgeBaseId: binding.knowledgeBaseId,
        changedFields: Object.keys(input),
        isEnabled: binding.isEnabled,
      },
    });

    return mapAssistantKnowledgeBinding(binding);
  },

  async removeBinding(assistantId: string, bindingId: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(assistantId, user);
    const binding = await knowledgeRepository.disableBinding(assistant.id, bindingId, user.tenant.id, userWorkspaceIds(user));
    if (!binding) {
      throw new AppError(404, 'KNOWLEDGE_BINDING_NOT_FOUND', 'Binding de conhecimento nao encontrado.');
    }

    await audit({
      user,
      context,
      action: 'knowledge_binding_removed',
      entity: 'assistant_knowledge_binding',
      entityId: binding.id,
      workspaceId: assistant.workspaceId,
      metadata: {
        assistantId: assistant.id,
        knowledgeBaseId: binding.knowledgeBaseId,
        removalMode: 'soft_disable',
      },
    });
  },
};
