import type { AgentRunStatus, AnalyticsData } from '@/types';
import { env } from '@/lib/env';
import { mockAnalytics } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type ApiEnvelope, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

export interface RuntimeRunFilters {
  page?: number;
  perPage?: number;
  status?: AgentRunStatus;
  runtimeProvider?: string;
  ragMode?: string;
  responseScopeMode?: string;
  fallbackOutsideKnowledgeUsed?: boolean;
  externalProviderCalled?: boolean;
  externalMcpCalled?: boolean;
  usageLimitBlocked?: boolean;
  search?: string;
}

export interface RuntimeRunSummary {
  runId: string;
  assistantId: string;
  assistantName: string | null;
  assistantVersionId: string | null;
  assistantVersion: string | null;
  status: AgentRunStatus;
  mode: string;
  inputSummary: string | null;
  requestId: string | null;
  traceId: string | null;
  runtimeProvider: string | null;
  llmProvider: string | null;
  model: string | null;
  responseScopeMode: string | null;
  ragMode: string | null;
  ragSourceCount: number | null;
  ragIntentDetected: boolean | null;
  ragSkippedReason: string | null;
  fallbackOutsideKnowledgeUsed: boolean | null;
  rawContentLogged: boolean | null;
  usageLimitEvaluationApplied: boolean | null;
  usageLimitMode: string | null;
  usageLimitExceeded: boolean | null;
  usageLimitEnforced: boolean | null;
  usageLimitBlocked: boolean | null;
  usageLimitMetric: string | null;
  usageLimitScope: string | null;
  usageLimitPolicyId: string | null;
  usageLimitWindow: string | null;
  usageLimitCurrentValue: string | null;
  usageLimitThreshold: string | null;
  usageLimitReason: string | null;
  externalProviderCalled: boolean | null;
  externalMcpCalled: boolean | null;
  mcpRemoteEvaluationApplied?: boolean | null;
  mcpRemoteAllowed?: boolean | null;
  mcpRemoteBlocked?: boolean | null;
  mcpRemoteReadOnly?: boolean | null;
  mcpRemoteBlockedReason?: string | null;
  mcpRemoteHost?: string | null;
  mcpRemoteToolId?: string | null;
  mcpRemoteRiskLevel?: string | null;
  responseBytes?: number | null;
  simulated?: boolean | null;
  toolCallsExecuted: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costCurrency: string | null;
  costMinorUnits: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RuntimeRunEventMetadata {
  runtimeProvider?: string;
  llmProvider?: string;
  model?: string;
  responseScopeMode?: string;
  ragMode?: string;
  ragSourceCount?: number;
  ragIntentDetected?: boolean;
  ragSkippedReason?: string;
  fallbackOutsideKnowledgeUsed?: boolean;
  rawContentLogged?: boolean;
  usageLimitEvaluationApplied?: boolean;
  usageLimitMode?: string;
  usageLimitExceeded?: boolean;
  usageLimitEnforced?: boolean;
  usageLimitBlocked?: boolean;
  usageLimitMetric?: string;
  usageLimitScope?: string;
  usageLimitPolicyId?: string;
  usageLimitWindow?: string;
  usageLimitCurrentValue?: string;
  usageLimitThreshold?: string;
  usageLimitReason?: string;
  externalProviderCalled?: boolean;
  externalMcpCalled?: boolean;
  mcpRemoteEvaluationApplied?: boolean;
  mcpRemoteAllowed?: boolean;
  mcpRemoteBlocked?: boolean;
  mcpRemoteReadOnly?: boolean;
  mcpRemoteBlockedReason?: string;
  mcpRemoteHost?: string;
  mcpRemoteToolId?: string;
  mcpRemoteRiskLevel?: string;
  responseBytes?: number;
  simulated?: boolean;
  toolCallsExecuted?: number;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface RuntimeRunEvent {
  id: string;
  type: string | null;
  sequence: number;
  status: string | null;
  metadata: RuntimeRunEventMetadata;
  createdAt: string;
}

export interface RuntimeRagSource {
  ragQueryId: string;
  rank: number;
  documentTitle: string | null;
  sourceLabel: string | null;
  matchType: string | null;
  score: number | null;
  excerpt: string | null;
}

export interface RuntimeRagQuerySummary {
  id: string;
  mode: string | null;
  status: string | null;
  resultCount: number;
  createdAt: string;
}

export interface RuntimeRunDetail extends RuntimeRunSummary {
  ragQueryId: string | null;
  ragQueries: RuntimeRagQuerySummary[];
  ragSources: RuntimeRagSource[];
  events: RuntimeRunEvent[];
}

export interface RuntimeSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  blockedRuns: number;
  usageLimitBlockedRuns: number;
  monitorOnlyViolations: number;
  runningRuns: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  totalTokens: string | null;
}

export interface RuntimeRunsPage {
  data: RuntimeRunSummary[];
  pagination: PaginatedApiEnvelope<RuntimeRunSummary>['pagination'];
}

// Demo-only fixture. It is reachable exclusively through the VITE_USE_MOCKS guard below.
const mockRun: RuntimeRunDetail = {
  runId: '00000000-0000-0000-0000-00000000016d',
  assistantId: '1',
  assistantName: 'Assistente de demonstração',
  assistantVersionId: 'v1',
  assistantVersion: '1.0.0',
  status: 'completed',
  mode: 'sandbox',
  inputSummary: 'Consultar a base operacional com escopo seguro.',
  requestId: 'req_mock_16m',
  traceId: 'trace_mock_16m',
  runtimeProvider: 'local',
  llmProvider: 'local_deterministic',
  model: 'local-deterministic-v1',
  responseScopeMode: 'knowledge_first',
  ragMode: 'local_keyword',
  ragSourceCount: 1,
  ragIntentDetected: true,
  ragSkippedReason: null,
  fallbackOutsideKnowledgeUsed: false,
  rawContentLogged: false,
  usageLimitEvaluationApplied: true,
  usageLimitMode: 'monitor_only',
  usageLimitExceeded: true,
  usageLimitEnforced: false,
  usageLimitBlocked: false,
  usageLimitMetric: 'run_count',
  usageLimitScope: 'assistant',
  usageLimitPolicyId: '00000000-0000-0000-0000-00000000016a',
  usageLimitWindow: 'day',
  usageLimitCurrentValue: '10',
  usageLimitThreshold: '10',
  usageLimitReason: 'limit_exceeded',
  externalProviderCalled: false,
  externalMcpCalled: false,
  mcpRemoteEvaluationApplied: false,
  mcpRemoteAllowed: false,
  mcpRemoteBlocked: false,
  mcpRemoteReadOnly: false,
  mcpRemoteBlockedReason: null,
  mcpRemoteHost: null,
  mcpRemoteToolId: null,
  mcpRemoteRiskLevel: null,
  responseBytes: null,
  simulated: true,
  toolCallsExecuted: 0,
  latencyMs: 18,
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  costCurrency: null,
  costMinorUnits: null,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ragQueryId: 'mock-rag-query-16m',
  ragQueries: [{
    id: 'mock-rag-query-16m',
    mode: 'local_keyword',
    status: 'completed',
    resultCount: 1,
    createdAt: new Date().toISOString(),
  }],
  ragSources: [{
    ragQueryId: 'mock-rag-query-16m',
    rank: 1,
    documentTitle: 'Runbook operacional',
    sourceLabel: 'Observabilidade',
    matchType: 'content',
    score: 0.94,
    excerpt: 'Excerpt persistido e truncado para demonstração segura.',
  }],
  events: [{
    id: 'mock-event-16m',
    type: 'runtime.run_completed',
    sequence: 1,
    status: 'completed',
    metadata: { runtimeProvider: 'local', externalProviderCalled: false },
    createdAt: new Date().toISOString(),
  }],
};

const mockSummary: RuntimeSummary = {
  totalRuns: 1,
  completedRuns: 1,
  failedRuns: 0,
  blockedRuns: 0,
  usageLimitBlockedRuns: 0,
  monitorOnlyViolations: 1,
  runningRuns: 0,
  successRate: 100,
  avgLatencyMs: 18,
  totalTokens: null,
};

function filteredMockRuns(filters: RuntimeRunFilters) {
  const matches = (!filters.status || mockRun.status === filters.status)
    && (!filters.runtimeProvider || mockRun.runtimeProvider === filters.runtimeProvider)
    && (!filters.ragMode || mockRun.ragMode === filters.ragMode)
    && (!filters.responseScopeMode || mockRun.responseScopeMode === filters.responseScopeMode)
    && (filters.fallbackOutsideKnowledgeUsed === undefined || mockRun.fallbackOutsideKnowledgeUsed === filters.fallbackOutsideKnowledgeUsed)
    && (filters.externalProviderCalled === undefined || mockRun.externalProviderCalled === filters.externalProviderCalled)
    && (filters.externalMcpCalled === undefined || mockRun.externalMcpCalled === filters.externalMcpCalled)
    && (filters.usageLimitBlocked === undefined || mockRun.usageLimitBlocked === filters.usageLimitBlocked)
    && (!filters.search || mockRun.inputSummary?.toLowerCase().includes(filters.search.toLowerCase()));
  return matches ? [mockRun] : [];
}

function toLegacyAnalytics(runs: RuntimeRunSummary[]): AnalyticsData[] {
  const days = new Map<string, {
    conversations: number;
    cost: number;
    toolCalls: number;
    latencyTotal: number;
    latencyCount: number;
  }>();
  for (const run of runs) {
    const date = run.createdAt.slice(0, 10);
    const current = days.get(date) ?? {
      conversations: 0,
      cost: 0,
      toolCalls: 0,
      latencyTotal: 0,
      latencyCount: 0,
    };
    current.conversations += 1;
    current.toolCalls += run.toolCallsExecuted ?? 0;
    if (run.latencyMs !== null) {
      current.latencyTotal += run.latencyMs;
      current.latencyCount += 1;
    }
    if (run.costCurrency && run.costMinorUnits) {
      const minorUnits = Number(run.costMinorUnits);
      if (Number.isSafeInteger(minorUnits)) current.cost += minorUnits / 100;
    }
    days.set(date, current);
  }
  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, item]) => ({
      date,
      conversations: item.conversations,
      cost: item.cost,
      toolCalls: item.toolCalls,
      latency: item.latencyCount ? item.latencyTotal / item.latencyCount / 1000 : 0,
    }));
}

export const analyticsService = {
  async overview(): Promise<AnalyticsData[]> {
    if (env.useMocks) return mockResponse(mockAnalytics);
    const page = await analyticsService.runtimeRuns({ page: 1, perPage: 100 });
    return toLegacyAnalytics(page.data);
  },

  async runtimeRuns(filters: RuntimeRunFilters = {}): Promise<RuntimeRunsPage> {
    if (env.useMocks) {
      const data = filteredMockRuns(filters);
      return mockResponse({
        data,
        pagination: { page: 1, perPage: filters.perPage ?? 20, total: data.length, totalPages: data.length ? 1 : 0 },
      });
    }
    const response = await apiClient.get<PaginatedApiEnvelope<RuntimeRunSummary>>(
      endpoints.analytics.runtimeRuns,
      { params: filters },
    );
    return { data: response.data.data, pagination: response.data.pagination };
  },

  async runtimeRun(runId: string): Promise<RuntimeRunDetail> {
    if (env.useMocks) return mockResponse(mockRun);
    const response = await apiClient.get<ApiEnvelope<RuntimeRunDetail>>(
      endpoints.analytics.runtimeRun(runId),
    );
    return response.data.data;
  },

  async runtimeSummary(): Promise<RuntimeSummary> {
    if (env.useMocks) return mockResponse(mockSummary);
    const response = await apiClient.get<ApiEnvelope<RuntimeSummary>>(
      endpoints.analytics.runtimeSummary,
    );
    return response.data.data;
  },
};
