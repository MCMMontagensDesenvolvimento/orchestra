import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '@/services/api/endpoints';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    appEnv: 'test',
    isProductionLike: false,
    useMocks: false,
    mockModeAllowed: true,
    mockModeBlockedReason: null,
    mockDelayMs: 0,
    mockScenario: 'success',
    apiBaseUrl: '/api/v1',
  },
}));

vi.mock('@/services/api/api-client', () => ({
  apiClient: {
    get: apiGet,
    post: apiPost,
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { assistantsService } from '@/services/assistants.service';
import { agentRunsService } from '@/services/agent-runs.service';
import { analyticsService } from '@/services/analytics.service';
import { auditService } from '@/services/audit.service';
import { chatService } from '@/services/chat.service';
import { knowledgeService } from '@/services/knowledge.service';
import { llmService } from '@/services/llm.service';
import { mcpService } from '@/services/mcp.service';
import { runtimeService } from '@/services/runtime.service';

const paginatedEmpty = {
  data: [],
  pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

describe('services in real API mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses backend endpoints for mature domains when mocks are disabled', async () => {
    apiGet.mockResolvedValue({ data: paginatedEmpty });

    await expect(assistantsService.list()).resolves.toEqual([]);
    await expect(agentRunsService.list()).resolves.toEqual([]);
    await expect(auditService.logs()).resolves.toEqual([]);
    await expect(knowledgeService.list()).resolves.toEqual([]);
    await expect(mcpService.servers()).resolves.toEqual([]);

    apiGet.mockResolvedValue({ data: { data: [] } });
    await expect(llmService.providers()).resolves.toEqual([]);
    await expect(runtimeService.providers()).resolves.toEqual([]);

    expect(apiGet).toHaveBeenCalledWith(endpoints.assistants.list);
    expect(apiGet).toHaveBeenCalledWith(endpoints.agentRuns.list);
    expect(apiGet).toHaveBeenCalledWith(endpoints.audit.logs);
    expect(apiGet).toHaveBeenCalledWith(endpoints.knowledge.list);
    expect(apiGet).toHaveBeenCalledWith(endpoints.mcp.servers);
    expect(apiGet).toHaveBeenCalledWith(endpoints.llm.providers);
    expect(apiGet).toHaveBeenCalledWith(endpoints.runtime.providers);
  });

  it('propagates an API failure instead of returning assistants from mock data', async () => {
    const backendError = new Error('backend unavailable');
    apiGet.mockRejectedValueOnce(backendError);

    await expect(assistantsService.list()).rejects.toBe(backendError);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith(endpoints.assistants.list);
  });

  it('returns an honest empty analytics state while the real endpoint is unsupported', async () => {
    await expect(analyticsService.overview()).resolves.toEqual([]);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('uses backend chat conversation endpoints when mocks are disabled', async () => {
    const conversation = {
      id: 'conversation-1',
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      assistantId: 'assistant-1',
      ownerUserId: 'user-1',
      title: 'Minha conversa',
      visibility: 'private',
      archivedAt: null,
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:00.000Z',
      messageCount: 0,
      lastMessage: null,
      lastMessageAt: null,
      messages: [],
    };
    const sendResponse = {
      conversation,
      userMessage: {
        id: 'message-user-1',
        tenantId: 'tenant-1',
        workspaceId: 'workspace-1',
        conversationId: 'conversation-1',
        assistantId: 'assistant-1',
        userId: 'user-1',
        role: 'user',
        content: 'Ola',
        agentRunId: null,
        createdAt: '2026-07-03T12:00:00.000Z',
        agentRun: null,
      },
      assistantMessage: {
        id: 'message-assistant-1',
        tenantId: 'tenant-1',
        workspaceId: 'workspace-1',
        conversationId: 'conversation-1',
        assistantId: 'assistant-1',
        userId: null,
        role: 'assistant',
        content: 'Resposta',
        agentRunId: 'run-1',
        createdAt: '2026-07-03T12:00:01.000Z',
        agentRun: null,
      },
      run: {
        id: 'run-1',
        tenantId: 'tenant-1',
        workspaceId: 'workspace-1',
        assistantId: 'assistant-1',
        requestedById: 'user-1',
        status: 'completed',
        mode: 'published',
        source: 'chat-conversation',
        traceId: 'trace-1',
        createdAt: '2026-07-03T12:00:00.000Z',
        updatedAt: '2026-07-03T12:00:01.000Z',
      },
    };

    apiGet
      .mockResolvedValueOnce({ data: { data: [conversation] } })
      .mockResolvedValueOnce({ data: { data: conversation } });
    apiPost
      .mockResolvedValueOnce({ data: { data: conversation } })
      .mockResolvedValueOnce({ data: { data: sendResponse } })
      .mockResolvedValueOnce({ data: { data: { ...conversation, archivedAt: '2026-07-03T12:10:00.000Z' } } });

    await expect(chatService.conversations('assistant-1')).resolves.toEqual([conversation]);
    await expect(chatService.getConversation('conversation-1')).resolves.toEqual(conversation);
    await expect(chatService.createConversation('assistant-1', { title: 'Minha conversa' })).resolves.toEqual(conversation);
    await expect(chatService.sendMessage('conversation-1', 'Ola')).resolves.toEqual(sendResponse);
    await expect(chatService.archiveConversation('conversation-1')).resolves.toEqual({ ...conversation, archivedAt: '2026-07-03T12:10:00.000Z' });

    expect(apiGet).toHaveBeenCalledWith(endpoints.assistants.conversations('assistant-1'), { params: { includeArchived: false } });
    expect(apiGet).toHaveBeenCalledWith(endpoints.chat.conversation('conversation-1'));
    expect(apiPost).toHaveBeenCalledWith(endpoints.assistants.conversations('assistant-1'), { title: 'Minha conversa' });
    expect(apiPost).toHaveBeenCalledWith(endpoints.chat.send('conversation-1'), { input: 'Ola' });
    expect(apiPost).toHaveBeenCalledWith(endpoints.chat.archive('conversation-1'));
  });

  it('creates assistant runs through the backend AgentRun endpoint', async () => {
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      assistantId: 'assistant-1',
      requestedById: 'user-1',
      status: 'completed',
      mode: 'published',
      source: 'frontend-chat',
      traceId: 'trace-1',
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:01.000Z',
    };
    apiPost.mockResolvedValueOnce({ data: { data: run } });

    await expect(agentRunsService.createForAssistant('assistant-1', {
      mode: 'published',
      input: 'Ola',
      source: 'frontend-chat',
      metadata: { origin: 'chat-ui' },
    })).resolves.toBe(run);

    expect(apiPost).toHaveBeenCalledWith(endpoints.assistants.runs('assistant-1'), {
      mode: 'published',
      input: 'Ola',
      source: 'frontend-chat',
      metadata: { origin: 'chat-ui' },
    });
  });

  it('lists assistant runs and run events through backend AgentRun endpoints', async () => {
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      assistantId: 'assistant-1',
      requestedById: 'user-1',
      status: 'completed',
      mode: 'published',
      source: 'frontend-chat',
      traceId: 'trace-1',
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:01.000Z',
    };
    const event = {
      id: 'event-1',
      agentRunId: 'run-1',
      type: 'run.precheck_passed',
      sequence: 2,
      status: 'running',
      message: 'Precheck aprovado.',
      metadata: { provider: 'local' },
      createdAt: '2026-07-03T12:00:00.000Z',
    };

    apiGet
      .mockResolvedValueOnce({ data: { data: [run], pagination: paginatedEmpty.pagination } })
      .mockResolvedValueOnce({ data: { data: [event] } });

    await expect(agentRunsService.listForAssistant('assistant-1')).resolves.toEqual([run]);
    await expect(agentRunsService.events('run-1')).resolves.toEqual([event]);

    expect(apiGet).toHaveBeenCalledWith(endpoints.assistants.runs('assistant-1'));
    expect(apiGet).toHaveBeenCalledWith(endpoints.agentRuns.events('run-1'));
  });
});
