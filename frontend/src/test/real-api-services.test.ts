import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '@/services/api/endpoints';

const apiGet = vi.hoisted(() => vi.fn());

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
    post: vi.fn(),
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

  it('keeps chat unavailable instead of returning demo conversations', async () => {
    await expect(chatService.conversations()).rejects.toThrow(/API real ainda/i);
    await expect(chatService.messages('conversation-1')).rejects.toThrow(/API real ainda/i);
    expect(apiGet).not.toHaveBeenCalled();
  });
});
