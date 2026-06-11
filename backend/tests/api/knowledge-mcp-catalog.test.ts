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
    requestIngestion: vi.fn(),
    listIngestionJobs: vi.fn(),
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
const mcpServerId = '00000000-0000-0000-0000-000000000701';
const mcpToolId = '00000000-0000-0000-0000-000000000801';
const mcpBindingId = '00000000-0000-0000-0000-000000000901';
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

function ingestionJobFixture() {
  return {
    id: ingestionJobId,
    tenantId,
    workspaceId,
    knowledgeBaseId,
    documentId,
    status: 'completed_placeholder',
    startedAt: now,
    completedAt: now,
    errorCode: null,
    errorMessage: null,
    metadata: { placeholderOnly: true },
    createdAt: now,
    updatedAt: now,
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
    mocks.knowledgeRepository.requestIngestion.mockResolvedValue({
      document: documentFixture({ status: 'indexed_placeholder', ingestionStatus: 'completed_placeholder' }),
      job: ingestionJobFixture(),
    });
    mocks.knowledgeRepository.listIngestionJobs.mockResolvedValue([ingestionJobFixture()]);
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

  it('creates document, data source and ingestion placeholder', async () => {
    await request(createApp())
      .post(`/api/v1/knowledge-bases/${knowledgeBaseId}/documents`)
      .set('Cookie', [sessionCookie()])
      .send({ title: 'Governance document', sourceType: 'manual', mimeType: 'text/plain' })
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

    expect(ingestionResponse.body.data.job.status).toBe('completed_placeholder');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_document_created' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_ingestion_requested' }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'knowledge_data_source_created' }));
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
