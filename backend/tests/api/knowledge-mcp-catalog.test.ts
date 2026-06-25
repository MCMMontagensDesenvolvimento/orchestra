import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => {
  const knowledgeRepository = {
    listKnowledgeBases: vi.fn(),
    findKnowledgeBaseById: vi.fn(),
    createKnowledgeBase: vi.fn(),
    updateKnowledgeBase: vi.fn(),
    archiveKnowledgeBase: vi.fn(),
    restoreKnowledgeBase: vi.fn(),
    listDocuments: vi.fn(),
    findDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    archiveDocument: vi.fn(),
    recordFailedIngestion: vi.fn(),
    requestIngestion: vi.fn(),
    listIngestionJobs: vi.fn(),
    findIngestionJob: vi.fn(),
    listDocumentChunks: vi.fn(),
    listKnowledgeBaseChunks: vi.fn(),
    findChunk: vi.fn(),
    listDocumentSourceReferences: vi.fn(),
    listChunkSourceReferences: vi.fn(),
    getRagReadiness: vi.fn(),
    localSearch: vi.fn(),
    findRagRetrievalCandidates: vi.fn(),
    createRagQueryWithResults: vi.fn(),
    listRagQueries: vi.fn(),
    findRagQuery: vi.fn(),
    listRagQueryResults: vi.fn(),
    listDataSources: vi.fn(),
    createDataSource: vi.fn(),
    updateDataSource: vi.fn(),
    archiveDataSource: vi.fn(),
    findAssistant: vi.fn(),
    listBindings: vi.fn(),
    createBinding: vi.fn(),
    updateBinding: vi.fn(),
    disableBinding: vi.fn(),
  };
  const mcpRepository = {
    listServers: vi.fn(),
    findServer: vi.fn(),
    createServer: vi.fn(),
    updateServer: vi.fn(),
    archiveServer: vi.fn(),
    restoreServer: vi.fn(),
    listTools: vi.fn(),
    findTool: vi.fn(),
    createTool: vi.fn(),
    updateTool: vi.fn(),
    archiveTool: vi.fn(),
    listResources: vi.fn(),
    createResource: vi.fn(),
    listPrompts: vi.fn(),
    createPrompt: vi.fn(),
    findAssistant: vi.fn(),
    findAssistantForExecution: vi.fn(),
    getExecutionPolicy: vi.fn(),
    listMatchingBindings: vi.fn(),
    findToolForExecution: vi.fn(),
    findAgentRunForMcp: vi.fn(),
    createMcpToolCallWithEvents: vi.fn(),
    listMcpToolCalls: vi.fn(),
    findMcpToolCall: vi.fn(),
    listMcpToolCallEvents: vi.fn(),
    listBindings: vi.fn(),
    createBinding: vi.fn(),
    updateBinding: vi.fn(),
    disableBinding: vi.fn(),
  };
  return {
    knowledgeRepository,
    mcpRepository,
    recordAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../src/modules/knowledge/knowledge.repository', () => ({
  knowledgeRepository: mocks.knowledgeRepository,
}));

vi.mock('../../src/modules/mcp/mcp.repository', () => ({
  mcpRepository: mocks.mcpRepository,
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const otherWorkspaceId = '00000000-0000-0000-0000-000000000021';
const userId = '00000000-0000-0000-0000-000000000001';
const assistantId = '00000000-0000-0000-0000-000000000101';
const knowledgeBaseId = '00000000-0000-0000-0000-000000000201';
const documentId = '00000000-0000-0000-0000-000000000301';
const dataSourceId = '00000000-0000-0000-0000-000000000401';
const ingestionJobId = '00000000-0000-0000-0000-000000000501';
const knowledgeBindingId = '00000000-0000-0000-0000-000000000601';
const chunkId = '00000000-0000-0000-0000-000000000611';
const sourceReferenceId = '00000000-0000-0000-0000-000000000612';
const ragQueryId = '00000000-0000-0000-0000-000000000621';
const ragQueryResultId = '00000000-0000-0000-0000-000000000622';
const mcpServerId = '00000000-0000-0000-0000-000000000701';
const mcpToolId = '00000000-0000-0000-0000-000000000801';
const mcpBindingId = '00000000-0000-0000-0000-000000000901';
const mcpToolCallId = '00000000-0000-0000-0000-000000000911';
const mcpToolCallEventId = '00000000-0000-0000-0000-000000000912';
const agentRunId = '00000000-0000-0000-0000-000000000921';
const now = new Date('2026-06-11T12:00:00.000Z');

const catalogPermissions = [
  'assistants.read',
  'knowledge.read',
  'knowledge.create',
  'knowledge.update',
  'knowledge.archive',
  'knowledge.restore',
  'knowledge.bind',
  'knowledge.ingestion.read',
  'knowledge.ingestion.manage',
  'mcp.read',
  'mcp.create',
  'mcp.update',
  'mcp.archive',
  'mcp.restore',
  'mcp.bind',
  'mcp.tools.read',
  'mcp.tools.manage',
  'mcp.policies.manage',
  'execution.precheck',
  'execution.run_sandbox',
];

const testUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: workspaceId,
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: catalogPermissions,
};

function sessionCookie(user: AuthenticatedUser = testUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

function knowledgePolicyFixture() {
  return {
    id: '00000000-0000-0000-0000-000000000202',
    tenantId,
    workspaceId,
    knowledgeBaseId,
    allowRuntimeRetrieval: false,
    allowCitationOnly: true,
    requireApprovalForExternal: true,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

function knowledgeBaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: knowledgeBaseId,
    tenantId,
    workspaceId,
    name: 'Governed Knowledge',
    description: 'Catalog entry.',
    status: 'active',
    visibility: 'workspace',
    dataClassification: 'internal',
    ownerUserId: userId,
    metadata: { source: 'api-test' },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    owner: { id: userId, name: 'Development Admin', email: 'admin.dev@orchestra.local' },
    policies: [knowledgePolicyFixture()],
    _count: { documents: 1, dataSources: 1, bindings: 1, ingestionJobs: 1 },
    ...overrides,
  };
}

function documentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: documentId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    title: 'Governance document',
    description: null,
    sourceType: 'manual',
    sourceUri: null,
    mimeType: 'text/plain',
    status: 'draft',
    ingestionStatus: 'pending',
    ingestionErrorCode: null,
    ingestionErrorMessage: null,
    dataClassification: 'internal',
    contentText: 'Politica operacional de teste para ingestao local. Este texto gera chunks locais.',
    contentHash: null,
    ingestedAt: null,
    chunkCount: 0,
    metadata: null,
    createdById: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function dataSourceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: dataSourceId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    name: 'Manual source',
    type: 'manual',
    config: { note: 'placeholder only' },
    status: 'active',
    createdById: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function ingestionJobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ingestionJobId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    documentId,
    status: 'completed',
    strategy: 'local_text_chunking',
    startedAt: now,
    completedAt: now,
    errorCode: null,
    errorMessage: null,
    chunksCreated: 1,
    sourceReferencesCreated: 1,
    metadata: { strategy: 'local_text_chunking' },
    createdById: userId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function ingestionEventFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000613',
    jobId: ingestionJobId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    documentId,
    eventType: 'knowledge_ingestion_completed',
    level: 'info',
    message: 'Local text ingestion completed.',
    metadata: { chunksCreated: 1 },
    createdAt: now,
    ...overrides,
  };
}

function chunkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: chunkId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    documentId,
    chunkIndex: 0,
    content: 'Politica operacional de teste para ingestao local.',
    contentHash: 'chunk-hash',
    tokenEstimate: 12,
    charCount: 52,
    status: 'active',
    metadata: { startOffset: 0, endOffset: 52 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sourceReferenceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: sourceReferenceId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    documentId,
    chunkId,
    label: 'Governance document #1',
    sourceType: 'manual',
    sourceUri: `knowledge-document://${documentId}`,
    sectionTitle: 'Governance document',
    pageNumber: null,
    startOffset: 0,
    endOffset: 52,
    metadata: { strategy: 'local_text_chunking' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function assistantFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: assistantId,
    tenantId,
    workspaceId,
    status: 'draft',
    deletedAt: null,
    ...overrides,
  };
}

function knowledgeBindingFixture() {
  return {
    id: knowledgeBindingId,
    tenantId,
    workspaceId,
    assistantId,
    knowledgeBaseId,
    isEnabled: true,
    retrievalMode: 'retrieval_placeholder',
    priority: 100,
    createdById: userId,
    createdAt: now,
    updatedAt: now,
    knowledgeBase: knowledgeBaseFixture(),
  };
}

function ragReadinessFixture(overrides: Record<string, unknown> = {}) {
  const bindings = [knowledgeBindingFixture()];
  return {
    assistant: { id: assistantId, workspaceId },
    bindings,
    enabledBindings: bindings,
    activeBindings: bindings,
    activeKnowledgeBaseIds: [knowledgeBaseId],
    knowledgeBasesBound: 1,
    knowledgeBaseCount: 1,
    documentsIngested: 1,
    documentCount: 1,
    chunksAvailable: 1,
    chunkCount: 1,
    sourceReferenceCount: 1,
    enabledBindingCount: 1,
    blockedReasons: [],
    warnings: [],
    ...overrides,
  };
}

function ragCandidateChunkFixture() {
  return {
    ...chunkFixture(),
    document: {
      id: documentId,
      title: 'Governance document',
      sourceType: 'manual',
      sourceUri: `knowledge-document://${documentId}`,
      status: 'indexed',
      ingestionStatus: 'completed',
      deletedAt: null,
    },
    knowledgeBase: {
      id: knowledgeBaseId,
      name: 'Governed Knowledge',
      status: 'active',
      deletedAt: null,
      workspaceId,
    },
    sourceReferences: [sourceReferenceFixture()],
  };
}

function ragQueryResultFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ragQueryResultId,
    tenantId,
    workspaceId,
    ragQueryId,
    knowledgeBaseId,
    documentId,
    chunkId,
    sourceReferenceId,
    rank: 1,
    score: 0.8,
    matchType: 'mixed',
    excerpt: 'Politica operacional de teste para ingestao local.',
    citationLabel: 'Fonte 1',
    metadata: { rawScore: 8 },
    createdAt: now,
    document: { id: documentId, title: 'Governance document', sourceUri: `knowledge-document://${documentId}`, sourceType: 'manual' },
    sourceReference: { id: sourceReferenceId, label: 'Governance document #1', sourceUri: `knowledge-document://${documentId}`, sectionTitle: 'Governance document', pageNumber: null },
    ...overrides,
  };
}

function ragQueryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ragQueryId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: null,
    agentRunId: null,
    queryText: 'Politica operacional',
    normalizedQuery: 'politica operacional',
    mode: 'local_keyword',
    status: 'completed',
    limit: 5,
    resultCount: 1,
    blockedReason: null,
    errorCode: null,
    errorMessage: null,
    createdById: userId,
    requestId: 'req-test',
    traceId: null,
    metadata: { retrievalMode: 'local_chunks_only' },
    createdAt: now,
    results: [ragQueryResultFixture()],
    ...overrides,
  };
}

function mcpPolicyFixture(mcpToolIdValue: string | null = null) {
  return {
    id: mcpToolIdValue ? '00000000-0000-0000-0000-000000000802' : '00000000-0000-0000-0000-000000000702',
    tenantId,
    workspaceId,
    mcpServerId,
    mcpToolId: mcpToolIdValue,
    allowRuntimeExecution: false,
    sandboxOnly: true,
    requiresApproval: true,
    blockedByDefault: true,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

function mcpServerFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: mcpServerId,
    tenantId,
    workspaceId,
    name: 'Governed MCP Server',
    description: 'Catalog entry.',
    serverType: 'remote',
    baseUrl: 'https://mcp.example.local',
    status: 'active',
    trustLevel: 'restricted',
    riskLevel: 'medium',
    authType: 'none',
    secretRef: null,
    metadata: null,
    createdById: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: { id: userId, name: 'Development Admin', email: 'admin.dev@orchestra.local' },
    policies: [mcpPolicyFixture(null)],
    _count: { tools: 1, resources: 0, prompts: 0, bindings: 1 },
    ...overrides,
  };
}

function mcpToolFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: mcpToolId,
    tenantId,
    workspaceId,
    mcpServerId,
    name: 'search_records',
    description: 'Structural tool catalog.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    riskLevel: 'high',
    requiresApproval: true,
    isEnabled: true,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    server: mcpServerFixture(),
    policies: [mcpPolicyFixture(mcpToolId)],
    ...overrides,
  };
}

function mcpBindingFixture() {
  return {
    id: mcpBindingId,
    tenantId,
    workspaceId,
    assistantId,
    mcpServerId,
    mcpToolId,
    isEnabled: true,
    mode: 'sandbox_only',
    requiresApprovalOverride: null,
    createdById: userId,
    createdAt: now,
    updatedAt: now,
    server: mcpServerFixture(),
    tool: mcpToolFixture(),
  };
}

function assistantExecutionPolicyFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000922',
    tenantId,
    workspaceId,
    assistantId,
    executionMode: 'sandbox',
    requiresApprovalToPublish: false,
    sandboxEnabled: true,
    sandboxRequiresAuth: true,
    sandboxAllowedForRoles: null,
    sandboxBlocksExternalTools: true,
    sandboxBlocksRealProviders: true,
    sandboxLogsRequired: true,
    sandboxCostLimitPlaceholder: null,
    allowDraftTesting: true,
    allowPublishedExecution: false,
    isExecutionEnabled: false,
    createdAt: now,
    updatedAt: now,
    updatedById: null,
    ...overrides,
  };
}

function assistantForMcpExecutionFixture(overrides: Record<string, unknown> = {}) {
  return {
    ...assistantFixture(),
    versions: [{ id: '00000000-0000-0000-0000-000000000923', createdAt: now }],
    executionPolicy: assistantExecutionPolicyFixture(),
    ...overrides,
  };
}

function agentRunFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: agentRunId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: '00000000-0000-0000-0000-000000000923',
    assistantPublicationId: null,
    conversationId: null,
    requestedById: userId,
    status: 'running',
    mode: 'sandbox',
    source: 'api-test',
    inputSummary: 'sandbox run',
    requestId: 'req-run',
    traceId: 'trace-test-run',
    startedAt: now,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    blockedAt: null,
    errorCode: null,
    errorMessage: null,
    precheckSnapshot: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function lowRiskMcpToolFixture(overrides: Record<string, unknown> = {}) {
  return mcpToolFixture({
    riskLevel: 'low',
    requiresApproval: false,
    policies: [mcpPolicyFixture(mcpToolId)],
    ...overrides,
  });
}

function lowRiskMcpBindingFixture(overrides: Record<string, unknown> = {}) {
  const tool = lowRiskMcpToolFixture();
  return {
    ...mcpBindingFixture(),
    tool,
    requiresApprovalOverride: null,
    ...overrides,
  };
}

function mcpToolCallEventFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: mcpToolCallEventId,
    tenantId,
    workspaceId,
    toolCallId: mcpToolCallId,
    agentRunId: null,
    type: 'execution_completed',
    message: 'Execucao sandbox local concluida sem chamada MCP externa.',
    metadata: { sandbox: true },
    createdAt: now,
    ...overrides,
  };
}

function mcpToolCallFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: mcpToolCallId,
    tenantId,
    workspaceId,
    assistantId,
    assistantVersionId: '00000000-0000-0000-0000-000000000923',
    agentRunId: null,
    mcpServerId,
    mcpToolId,
    assistantMcpBindingId: mcpBindingId,
    requestedByUserId: userId,
    mode: 'sandbox',
    status: 'completed',
    riskLevelSnapshot: 'low',
    approvalRequiredSnapshot: false,
    requestId: 'req-test',
    traceId: 'trace-test',
    inputHash: 'hash-test',
    inputPreview: '{"query":"teste"}',
    outputPreview: 'Sandbox execution completed for tool "search_records". No external MCP server was called.',
    errorCode: null,
    errorMessage: null,
    policySnapshot: { status: 'allowed', reasons: [] },
    metadata: { sandbox: true, externalMcpCall: false },
    startedAt: now,
    completedAt: now,
    durationMs: 1,
    createdAt: now,
    updatedAt: now,
    server: mcpServerFixture(),
    tool: lowRiskMcpToolFixture(),
    assistantMcpBinding: lowRiskMcpBindingFixture(),
    events: [mcpToolCallEventFixture()],
    ...overrides,
  };
}

describe('knowledge and MCP catalog endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.knowledgeRepository.listKnowledgeBases.mockResolvedValue({ data: [knowledgeBaseFixture()], total: 1 });
    mocks.knowledgeRepository.findKnowledgeBaseById.mockResolvedValue(knowledgeBaseFixture());
    mocks.knowledgeRepository.createKnowledgeBase.mockResolvedValue(knowledgeBaseFixture());
    mocks.knowledgeRepository.listDocuments.mockResolvedValue([documentFixture()]);
    mocks.knowledgeRepository.createDocument.mockResolvedValue(documentFixture());
    mocks.knowledgeRepository.findDocument.mockResolvedValue(documentFixture());
    mocks.knowledgeRepository.recordFailedIngestion.mockResolvedValue({
      document: documentFixture({ status: 'failed', ingestionStatus: 'failed', ingestionErrorCode: 'KNOWLEDGE_DOCUMENT_NO_CONTENT', ingestionErrorMessage: 'Documento nao possui conteudo textual simples para ingestao local.' }),
      job: ingestionJobFixture({ status: 'failed', errorCode: 'KNOWLEDGE_DOCUMENT_NO_CONTENT', errorMessage: 'Documento nao possui conteudo textual simples para ingestao local.', chunksCreated: 0, sourceReferencesCreated: 0 }),
      events: [ingestionEventFixture({ eventType: 'knowledge_ingestion_failed', level: 'error' })],
    });
    mocks.knowledgeRepository.requestIngestion.mockResolvedValue({
      document: documentFixture({ status: 'indexed', ingestionStatus: 'completed', chunkCount: 1, contentHash: 'document-hash', ingestedAt: now }),
      job: ingestionJobFixture(),
      chunks: [chunkFixture()],
      sourceReferences: [sourceReferenceFixture()],
      events: [ingestionEventFixture()],
    });
    mocks.knowledgeRepository.listIngestionJobs.mockResolvedValue([ingestionJobFixture()]);
    mocks.knowledgeRepository.findIngestionJob.mockResolvedValue({ ...ingestionJobFixture(), events: [ingestionEventFixture()] });
    mocks.knowledgeRepository.listDocumentChunks.mockResolvedValue({ data: [chunkFixture()], total: 1 });
    mocks.knowledgeRepository.listKnowledgeBaseChunks.mockResolvedValue({ data: [chunkFixture()], total: 1 });
    mocks.knowledgeRepository.findChunk.mockResolvedValue(chunkFixture());
    mocks.knowledgeRepository.listDocumentSourceReferences.mockResolvedValue([sourceReferenceFixture()]);
    mocks.knowledgeRepository.listChunkSourceReferences.mockResolvedValue([sourceReferenceFixture()]);
    mocks.knowledgeRepository.getRagReadiness.mockResolvedValue(ragReadinessFixture());
    mocks.knowledgeRepository.localSearch.mockResolvedValue({
      readiness: ragReadinessFixture(),
      chunks: [chunkFixture({ sourceReferences: [sourceReferenceFixture()] })],
    });
    mocks.knowledgeRepository.findRagRetrievalCandidates.mockResolvedValue({
      readiness: ragReadinessFixture(),
      chunks: [ragCandidateChunkFixture()],
    });
    mocks.knowledgeRepository.createRagQueryWithResults.mockImplementation(async (input: {
      results?: Record<string, unknown>[];
      queryText: string;
      normalizedQuery: string;
      mode: string;
      status: string;
      limit: number;
      resultCount: number;
      blockedReason?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    }) => {
      const results = (input.results ?? []).map((result: Record<string, unknown>) => ragQueryResultFixture({
        ...result,
        ragQueryId,
        document: { id: documentId, title: 'Governance document', sourceUri: `knowledge-document://${documentId}`, sourceType: 'manual' },
        sourceReference: { id: sourceReferenceId, label: 'Governance document #1', sourceUri: `knowledge-document://${documentId}`, sectionTitle: 'Governance document', pageNumber: null },
      }));
      return ragQueryFixture({
        queryText: input.queryText,
        normalizedQuery: input.normalizedQuery,
        mode: input.mode,
        status: input.status,
        limit: input.limit,
        resultCount: input.resultCount,
        blockedReason: input.blockedReason ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        results,
      });
    });
    mocks.knowledgeRepository.listRagQueries.mockResolvedValue({ data: [ragQueryFixture({ results: undefined })], total: 1 });
    mocks.knowledgeRepository.findRagQuery.mockResolvedValue(ragQueryFixture());
    mocks.knowledgeRepository.listRagQueryResults.mockResolvedValue([ragQueryResultFixture()]);
    mocks.knowledgeRepository.listDataSources.mockResolvedValue([dataSourceFixture()]);
    mocks.knowledgeRepository.createDataSource.mockResolvedValue(dataSourceFixture());
    mocks.knowledgeRepository.findAssistant.mockResolvedValue(assistantFixture());
    mocks.knowledgeRepository.createBinding.mockResolvedValue(knowledgeBindingFixture());
    mocks.knowledgeRepository.listBindings.mockResolvedValue([knowledgeBindingFixture()]);

    mocks.mcpRepository.listServers.mockResolvedValue({ data: [mcpServerFixture()], total: 1 });
    mocks.mcpRepository.findServer.mockResolvedValue(mcpServerFixture());
    mocks.mcpRepository.createServer.mockResolvedValue(mcpServerFixture());
    mocks.mcpRepository.listTools.mockResolvedValue([mcpToolFixture()]);
    mocks.mcpRepository.findTool.mockResolvedValue(mcpToolFixture());
    mocks.mcpRepository.createTool.mockResolvedValue(mcpToolFixture());
    mocks.mcpRepository.findAssistant.mockResolvedValue(assistantFixture());
    mocks.mcpRepository.findAssistantForExecution.mockResolvedValue(assistantForMcpExecutionFixture());
    mocks.mcpRepository.getExecutionPolicy.mockResolvedValue(assistantExecutionPolicyFixture());
    mocks.mcpRepository.listMatchingBindings.mockResolvedValue([lowRiskMcpBindingFixture()]);
    mocks.mcpRepository.findToolForExecution.mockResolvedValue(lowRiskMcpToolFixture());
    mocks.mcpRepository.findAgentRunForMcp.mockResolvedValue(agentRunFixture());
    mocks.mcpRepository.createMcpToolCallWithEvents.mockImplementation(async (input: {
      status: string;
      agentRunId?: string | null;
      events?: Array<{ type: string; message?: string; metadata?: unknown }>;
      outputPreview?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      riskLevelSnapshot?: string;
      approvalRequiredSnapshot?: boolean;
      assistantMcpBindingId?: string | null;
      policySnapshot?: unknown;
      durationMs?: number | null;
    }) => mcpToolCallFixture({
      status: input.status,
      agentRunId: input.agentRunId ?? null,
      outputPreview: input.outputPreview ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      riskLevelSnapshot: input.riskLevelSnapshot ?? 'low',
      approvalRequiredSnapshot: input.approvalRequiredSnapshot ?? false,
      assistantMcpBindingId: input.assistantMcpBindingId ?? mcpBindingId,
      policySnapshot: input.policySnapshot ?? { status: input.status },
      durationMs: input.durationMs ?? 1,
      events: (input.events ?? []).map((event, index) => mcpToolCallEventFixture({
        id: `00000000-0000-0000-0000-0000000009${30 + index}`,
        type: event.type,
        message: event.message ?? null,
        metadata: event.metadata ?? null,
        agentRunId: input.agentRunId ?? null,
      })),
    }));
    mocks.mcpRepository.listMcpToolCalls.mockResolvedValue({ data: [mcpToolCallFixture()], total: 1 });
    mocks.mcpRepository.findMcpToolCall.mockResolvedValue(mcpToolCallFixture());
    mocks.mcpRepository.listMcpToolCallEvents.mockResolvedValue([mcpToolCallEventFixture()]);
    mocks.mcpRepository.createBinding.mockResolvedValue(mcpBindingFixture());
    mocks.mcpRepository.listBindings.mockResolvedValue([mcpBindingFixture()]);
  });

  it('creates and lists knowledge bases', async () => {
    const createResponse = await request(createApp())
      .post('/api/v1/knowledge-bases')
      .set('Cookie', [sessionCookie()])
      .send({ name: 'Governed Knowledge', visibility: 'workspace', dataClassification: 'internal' })
      .expect(201);

    const listResponse = await request(createApp())
      .get('/api/v1/knowledge-bases')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(createResponse.body.data.policy.allowCitationOnly).toBe(true);
    expect(listResponse.body.pagination.total).toBe(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_base_created' }));
  });

  it('creates document, data source and local ingestion', async () => {
    await request(createApp())
      .post(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents`)
      .set('Cookie', [sessionCookie()])
      .send({ title: 'Governance document', sourceType: 'manual', mimeType: 'text/plain', contentText: 'Politica operacional de teste para ingestao local.' })
      .expect(201);

    const ingestionResponse = await request(createApp())
      .post(`/api/v1/knowledge-documents/${documentId}/request-ingestion`)
      .set('Cookie', [sessionCookie()])
      .send({ metadata: { scenario: 'placeholder' } })
      .expect(201);

    await request(createApp())
      .post(`/api/v1/knowledge-bases/${knowledgeBaseId}/data-sources`)
      .set('Cookie', [sessionCookie()])
      .send({ name: 'Manual source', type: 'manual', config: { note: 'placeholder only' } })
      .expect(201);

    expect(ingestionResponse.body.data.job.status).toBe('completed');
    expect(ingestionResponse.body.data.chunksCreated).toBe(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_document_created' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_ingestion_requested' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_data_source_created' }));
  });

  it('persists failed local ingestion job before returning 422 for documents without text', async () => {
    mocks.knowledgeRepository.findDocument.mockResolvedValueOnce(documentFixture({ contentText: null }));

    const response = await request(createApp())
      .post(`/api/v1/knowledge-documents/${documentId}/request-ingestion`)
      .set('Cookie', [sessionCookie()])
      .send({ metadata: { scenario: 'no-content' } })
      .expect(422);

    expect(response.body.code).toBe('KNOWLEDGE_DOCUMENT_NO_CONTENT');
    expect(mocks.knowledgeRepository.recordFailedIngestion).toHaveBeenCalledWith(expect.objectContaining({
      documentId,
      errorCode: 'KNOWLEDGE_DOCUMENT_NO_CONTENT',
      createdById: userId,
    }));
    expect(mocks.knowledgeRepository.requestIngestion).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_ingestion_failed' }));
  });

  it('lists chunks, source references, job events and RAG readiness', async () => {
    const chunksResponse = await request(createApp())
      .get(`/api/v1/knowledge-documents/${documentId}/chunks`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const baseChunksResponse = await request(createApp())
      .get(`/api/v1/knowledge-bases/${knowledgeBaseId}/chunks`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const sourceReferencesResponse = await request(createApp())
      .get(`/api/v1/knowledge-documents/${documentId}/source-references`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const chunkResponse = await request(createApp())
      .get(`/api/v1/knowledge-chunks/${chunkId}`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const chunkSourcesResponse = await request(createApp())
      .get(`/api/v1/knowledge-chunks/${chunkId}/source-references`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const jobResponse = await request(createApp())
      .get(`/api/v1/knowledge-ingestion-jobs/${ingestionJobId}`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const readinessResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/rag-readiness`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const searchResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/rag-local-search`)
      .set('Cookie', [sessionCookie()])
      .send({ query: 'operacional' })
      .expect(200);

    expect(chunksResponse.body.data[0].id).toBe(chunkId);
    expect(baseChunksResponse.body.pagination.total).toBe(1);
    expect(sourceReferencesResponse.body.data[0].id).toBe(sourceReferenceId);
    expect(chunkResponse.body.data.content).toContain('Politica operacional');
    expect(chunkSourcesResponse.body.data[0].chunkId).toBe(chunkId);
    expect(jobResponse.body.data.events[0].eventType).toBe('knowledge_ingestion_completed');
    expect(readinessResponse.body.data.retrievalMode).toBe('local_chunks_only');
    expect(readinessResponse.body.data.embeddings).toMatchObject({
      enabled: false,
      configured: false,
      provider: 'disabled',
      status: 'disabled',
      failClosed: true,
      externalProviderCalled: false,
    });
    expect(searchResponse.body.data.mode).toBe('keyword_local_placeholder');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'rag_readiness_checked' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'rag_local_search_executed' }));
  });

  it('executes official RAG query contract with persisted citations and history', async () => {
    const queryResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/rag/query`)
      .set('Cookie', [sessionCookie()])
      .send({ query: 'Politica operacional', limit: 5 })
      .expect(201);

    const historyResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/rag/queries`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const detailResponse = await request(createApp())
      .get(`/api/v1/rag/queries/${ragQueryId}`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const sourcesResponse = await request(createApp())
      .get(`/api/v1/rag/queries/${ragQueryId}/sources`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(queryResponse.body.data.status).toBe('completed');
    expect(queryResponse.body.data.resultCount).toBe(1);
    expect(queryResponse.body.data.sources[0].citationLabel).toBe('Fonte 1');
    expect(queryResponse.body.data.sources[0].documentTitle).toBe('Governance document');
    expect(historyResponse.body.pagination.total).toBe(1);
    expect(detailResponse.body.data.queryId).toBe(ragQueryId);
    expect(sourcesResponse.body.data[0].sourceReferenceId).toBe(sourceReferenceId);
    expect(mocks.knowledgeRepository.createRagQueryWithResults).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      resultCount: 1,
      results: expect.arrayContaining([expect.objectContaining({ citationLabel: 'Fonte 1' })]),
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'rag_query_requested' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'rag_query_completed' }));
  });

  it('persists blocked official RAG query when readiness is not satisfied', async () => {
    mocks.knowledgeRepository.findRagRetrievalCandidates.mockResolvedValueOnce({
      readiness: ragReadinessFixture({
        activeKnowledgeBaseIds: [],
        knowledgeBasesBound: 0,
        knowledgeBaseCount: 0,
        documentsIngested: 0,
        documentCount: 0,
        chunksAvailable: 0,
        chunkCount: 0,
        sourceReferenceCount: 0,
        blockedReasons: ['NO_ENABLED_KNOWLEDGE_BINDINGS'],
      }),
      chunks: [],
    });

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/rag/query`)
      .set('Cookie', [sessionCookie()])
      .send({ query: 'Politica operacional', limit: 5 })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.code).toBe('RAG_NOT_READY');
    expect(response.body.data.reasons).toContain('NO_ENABLED_KNOWLEDGE_BINDINGS');
    expect(mocks.knowledgeRepository.createRagQueryWithResults).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      blockedReason: 'NO_ENABLED_KNOWLEDGE_BINDINGS',
      resultCount: 0,
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'rag_query_blocked' }));
  });

  it('validates official RAG query payload', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/rag/query`)
      .set('Cookie', [sessionCookie()])
      .send({ query: 'a', limit: 99 })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates and lists assistant knowledge bindings', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/knowledge-bindings`)
      .set('Cookie', [sessionCookie()])
      .send({ knowledgeBaseId, retrievalMode: 'retrieval_placeholder', priority: 10 })
      .expect(201);

    const listResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/knowledge-bindings`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.knowledgeBaseId).toBe(knowledgeBaseId);
    expect(listResponse.body.data).toHaveLength(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_binding_created' }));
  });

  it('blocks assistant knowledge binding across workspace scope', async () => {
    mocks.knowledgeRepository.findKnowledgeBaseById.mockResolvedValueOnce(knowledgeBaseFixture({ workspaceId: otherWorkspaceId }));

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/knowledge-bindings`)
      .set('Cookie', [sessionCookie()])
      .send({ knowledgeBaseId })
      .expect(403);

    expect(response.body.code).toBe('WORKSPACE_SCOPE_MISMATCH');
    expect(mocks.knowledgeRepository.createBinding).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'permission_denied' }));
  });

  it('creates and lists MCP servers and tools', async () => {
    const serverResponse = await request(createApp())
      .post('/api/v1/mcp/servers')
      .set('Cookie', [sessionCookie()])
      .send({
        name: 'Governed MCP Server',
        baseUrl: 'https://mcp.example.local',
        status: 'active',
        trustLevel: 'restricted',
      })
      .expect(201);

    const toolResponse = await request(createApp())
      .post(`/api/v1/mcp/servers/${mcpServerId}/tools`)
      .set('Cookie', [sessionCookie()])
      .send({ name: 'search_records', riskLevel: 'high', inputSchema: { type: 'object' } })
      .expect(201);

    await request(createApp())
      .get(`/api/v1/mcp/servers/${mcpServerId}/tools`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(serverResponse.body.data.status).toBe('active');
    expect(toolResponse.body.data.requiresApproval).toBe(true);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_server_created' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_tool_created' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_policy_updated' }));
  });

  it('creates assistant MCP binding but blocks false approval override for high risk tools', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp-bindings`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpServerId, mcpToolId, mode: 'sandbox_only' })
      .expect(201);

    expect(response.body.data.mcpToolId).toBe(mcpToolId);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_binding_created' }));

    const blockedResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp-bindings`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpServerId, mcpToolId, requiresApprovalOverride: false })
      .expect(422);

    expect(blockedResponse.body.code).toBe('MCP_APPROVAL_REQUIRED');
  });

  it('prechecks MCP sandbox execution as allowed for bound low risk tools', async () => {
    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp/precheck`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpToolId, mode: 'sandbox', input: { query: 'teste' } })
      .expect(200);

    expect(response.body.data.canExecute).toBe(true);
    expect(response.body.data.status).toBe('allowed');
    expect(response.body.data.policy.riskLevel).toBe('low');
    expect(response.body.data.policy.requiresApproval).toBe(false);
    expect(mocks.mcpRepository.listMatchingBindings).toHaveBeenCalledWith(assistantId, mcpServerId, mcpToolId, tenantId, [workspaceId]);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_execution_precheck_allowed' }));
  });

  it('executes deterministic MCP sandbox tool calls and exposes history detail and events', async () => {
    const callResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp/tool-calls`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpToolId, mode: 'sandbox', input: { query: 'teste' }, agentRunId })
      .expect(201);

    const historyResponse = await request(createApp())
      .get(`/api/v1/assistants/${assistantId}/mcp/tool-calls`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const detailResponse = await request(createApp())
      .get(`/api/v1/mcp/tool-calls/${mcpToolCallId}`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    const eventsResponse = await request(createApp())
      .get(`/api/v1/mcp/tool-calls/${mcpToolCallId}/events`)
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(callResponse.body.data.status).toBe('completed');
    expect(callResponse.body.data.mode).toBe('sandbox');
    expect(callResponse.body.data.outputPreview).toContain('No external MCP server was called');
    expect(callResponse.body.data.inputPreview).toContain('teste');
    expect(callResponse.body.data.events.map((event: { type: string }) => event.type)).toEqual([
      'precheck_started',
      'precheck_passed',
      'execution_started',
      'execution_completed',
    ]);
    expect(historyResponse.body.pagination.total).toBe(1);
    expect(detailResponse.body.data.id).toBe(mcpToolCallId);
    expect(eventsResponse.body.data[0].type).toBe('execution_completed');
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      agentRunId,
      inputPreview: expect.stringContaining('teste'),
      policySnapshot: expect.objectContaining({ status: 'allowed' }),
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_tool_call_completed' }));
  });

  it('persists blocked MCP sandbox tool calls without assistant binding', async () => {
    mocks.mcpRepository.listMatchingBindings.mockResolvedValueOnce([]);

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp/tool-calls`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpToolId, mode: 'sandbox', input: { query: 'teste' } })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.reasons).toContain('tool_not_bound_to_assistant');
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      assistantMcpBindingId: null,
      errorCode: 'tool_not_bound_to_assistant',
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_tool_call_blocked' }));
  });

  it('returns approval_required for high risk MCP sandbox tool calls', async () => {
    mocks.mcpRepository.findToolForExecution.mockResolvedValueOnce(mcpToolFixture());
    mocks.mcpRepository.listMatchingBindings.mockResolvedValueOnce([mcpBindingFixture()]);

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp/tool-calls`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpToolId, mode: 'sandbox', input: { query: 'teste' } })
      .expect(201);

    expect(response.body.data.status).toBe('approval_required');
    expect(response.body.data.reasons).toContain('tool_requires_approval');
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledWith(expect.objectContaining({
      status: 'approval_required',
      errorCode: 'tool_requires_approval',
      riskLevelSnapshot: 'high',
      approvalRequiredSnapshot: true,
    }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'mcp_tool_call_approval_required' }));
  });

  it('blocks disabled MCP tools during sandbox execution', async () => {
    mocks.mcpRepository.findToolForExecution.mockResolvedValueOnce(lowRiskMcpToolFixture({ isEnabled: false }));
    mocks.mcpRepository.listMatchingBindings.mockResolvedValueOnce([lowRiskMcpBindingFixture()]);

    const response = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp/tool-calls`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpToolId, mode: 'sandbox', input: { query: 'teste' } })
      .expect(201);

    expect(response.body.data.status).toBe('blocked');
    expect(response.body.data.reasons).toContain('tool_disabled');
    expect(mocks.mcpRepository.createMcpToolCallWithEvents).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      errorCode: 'tool_disabled',
    }));
  });

  it('returns structured MCP execution errors for missing records and invalid payloads', async () => {
    mocks.mcpRepository.findMcpToolCall.mockResolvedValueOnce(null);
    const notFoundResponse = await request(createApp())
      .get(`/api/v1/mcp/tool-calls/${mcpToolCallId}`)
      .set('Cookie', [sessionCookie()])
      .expect(404);

    const invalidResponse = await request(createApp())
      .post(`/api/v1/assistants/${assistantId}/mcp/tool-calls`)
      .set('Cookie', [sessionCookie()])
      .send({ mcpToolId: 'not-a-uuid', input: { query: 'teste' } })
      .expect(422);

    expect(notFoundResponse.body.code).toBe('MCP_TOOL_CALL_NOT_FOUND');
    expect(invalidResponse.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns structured errors for missing permissions, missing records and invalid payloads', async () => {
    await request(createApp())
      .post('/api/v1/knowledge-bases')
      .set('Cookie', [sessionCookie({ ...testUser, permissions: ['knowledge.read'] })])
      .send({ name: 'Blocked Knowledge' })
      .expect(403);

    mocks.knowledgeRepository.findKnowledgeBaseById.mockResolvedValueOnce(null);
    const notFoundResponse = await request(createApp())
      .get(`/api/v1/knowledge-bases/${knowledgeBaseId}`)
      .set('Cookie', [sessionCookie()])
      .expect(404);

    const invalidResponse = await request(createApp())
      .post('/api/v1/mcp/servers')
      .set('Cookie', [sessionCookie()])
      .send({ name: '' })
      .expect(422);

    expect(notFoundResponse.body.code).toBe('KNOWLEDGE_BASE_NOT_FOUND');
    expect(invalidResponse.body.code).toBe('VALIDATION_ERROR');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'permission_denied' }));
  });
});
