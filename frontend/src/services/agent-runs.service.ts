import type { AgentRun, AgentRunEvent, AgentRunStatus, AssistantExecutionMode, CreateAgentRunInput } from '@/types';
import { env } from '@/lib/env';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { apiClient, type ApiEnvelope, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const nowIso = () => new Date().toISOString();

const mockRuntimeMetadata = (status: AgentRunStatus) => ({
  provider: 'local',
  status,
  adapterMetadata: {
    llmProvider: 'local_deterministic',
    llmModel: 'local-deterministic-v1',
    llmLatencyMs: 12,
    externalProviderCalled: false,
    llmSelectionReason: 'assistant_policy_default_local',
    llm: {
      provider: 'local_deterministic',
      simulated: true,
      externalProviderCalled: false,
      failedClosed: false,
    },
  },
});

const mockRunEvents = (runId: string, traceId: string, mode: AssistantExecutionMode, status: AgentRunStatus): AgentRunEvent[] => {
  const now = nowIso();
  const events: AgentRunEvent[] = [
    {
      id: `${runId}-event-1`,
      agentRunId: runId,
      type: 'run.requested',
      sequence: 1,
      status: 'queued',
      message: 'Run solicitado pelo control plane.',
      metadata: { mode, traceId },
      createdAt: now,
    },
    {
      id: `${runId}-event-2`,
      agentRunId: runId,
      type: 'run.precheck_passed',
      sequence: 2,
      status: status === 'blocked' ? 'blocked' : 'running',
      message: status === 'blocked' ? 'Precheck bloqueou a execucao.' : 'Precheck aprovado.',
      metadata: { traceId },
      createdAt: now,
    },
  ];

  if (status === 'blocked') {
    events.push({
      id: `${runId}-event-3`,
      agentRunId: runId,
      type: 'run.blocked',
      sequence: 3,
      status: 'blocked',
      message: 'Execucao bloqueada por governanca.',
      metadata: { traceId },
      createdAt: now,
    });
    return events;
  }

  events.push(
    {
      id: `${runId}-event-3`,
      agentRunId: runId,
      type: 'runtime.provider_selected',
      sequence: 3,
      status: 'running',
      message: 'Runtime provider local selecionado pelo registry.',
      metadata: { traceId, provider: 'local' },
      createdAt: now,
    },
    {
      id: `${runId}-event-4`,
      agentRunId: runId,
      type: 'llm.provider_selected',
      sequence: 4,
      status: 'running',
      message: 'LLM provider local deterministico selecionado pelo runtime local.',
      metadata: {
        provider: 'local',
        llmProvider: 'local_deterministic',
        model: 'local-deterministic-v1',
        externalProviderCalled: false,
        reason: 'assistant_policy_default_local',
      },
      createdAt: now,
    },
    {
      id: `${runId}-event-5`,
      agentRunId: runId,
      type: 'llm.generation_started',
      sequence: 5,
      status: 'running',
      message: 'Geracao LLM local iniciada.',
      metadata: {
        provider: 'local',
        llmProvider: 'local_deterministic',
        simulated: true,
        externalProvidersCalled: false,
      },
      createdAt: now,
    },
    {
      id: `${runId}-event-6`,
      agentRunId: runId,
      type: 'llm.generation_completed',
      sequence: 6,
      status: 'completed',
      message: 'Geracao LLM local concluida.',
      metadata: {
        provider: 'local',
        llmProvider: 'local_deterministic',
        model: 'local-deterministic-v1',
        simulated: true,
        externalProvidersCalled: false,
        latencyMs: 12,
      },
      createdAt: now,
    },
    {
      id: `${runId}-event-7`,
      agentRunId: runId,
      type: 'runtime.model_completed',
      sequence: 7,
      status: 'completed',
      message: 'Modelo simulado concluiu resposta deterministica.',
      metadata: {
        provider: 'local',
        llmProvider: 'local_deterministic',
        model: 'local-deterministic-v1',
        simulated: true,
        externalProvidersCalled: false,
      },
      createdAt: now,
    },
    {
      id: `${runId}-event-8`,
      agentRunId: runId,
      type: 'runtime.run_completed',
      sequence: 8,
      status: 'completed',
      message: 'Run finalizado pelo adapter local deterministico.',
      metadata: { provider: 'local' },
      createdAt: now,
    },
  );
  return events;
};

const mockAgentRuns: AgentRun[] = [
  {
    id: 'mock-run-1',
    tenantId: 'mock-tenant',
    workspaceId: 'default',
    assistantId: '1',
    assistantVersionId: 'v1',
    assistantPublicationId: null,
    requestedById: 'mock-user-1',
    status: 'completed',
    mode: 'sandbox',
    source: 'mock',
    inputSummary: 'Validar resposta controlada sem runtime externo.',
    requestId: 'req_mock_1',
    traceId: 'trace_mock_1',
    startedAt: nowIso(),
    completedAt: nowIso(),
    failedAt: null,
    cancelledAt: null,
    blockedAt: null,
    errorCode: null,
    errorMessage: null,
    precheckSnapshot: { canExecute: true, mode: 'sandbox', reasons: [], requestId: 'req_mock_1' },
    metadata: {
      runtime: mockRuntimeMetadata('completed'),
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    events: mockRunEvents('mock-run-1', 'trace_mock_1', 'sandbox', 'completed'),
  },
];

export const agentRunsService = {
  async listForAssistant(assistantId: string): Promise<AgentRun[]> {
    if (env.useMocks) return mockResponse(mockAgentRuns.filter((run) => run.assistantId === assistantId || assistantId === '1'));
    const response = await apiClient.get<PaginatedApiEnvelope<AgentRun>>(endpoints.assistants.runs(assistantId));
    return response.data.data;
  },

  async list(): Promise<AgentRun[]> {
    if (env.useMocks) return mockResponse(mockAgentRuns);
    const response = await apiClient.get<PaginatedApiEnvelope<AgentRun>>(endpoints.agentRuns.list);
    return response.data.data;
  },

  async get(runId: string): Promise<AgentRun> {
    if (env.useMocks) return mockFind(mockAgentRuns, runId);
    const response = await apiClient.get<ApiEnvelope<AgentRun>>(endpoints.agentRuns.detail(runId));
    return response.data.data;
  },

  async events(runId: string): Promise<AgentRunEvent[]> {
    if (env.useMocks) return mockResponse((await mockFind(mockAgentRuns, runId)).events ?? []);
    const response = await apiClient.get<ApiEnvelope<AgentRunEvent[]>>(endpoints.agentRuns.events(runId));
    return response.data.data;
  },

  async createForAssistant(assistantId: string, input: CreateAgentRunInput): Promise<AgentRun> {
    if (env.useMocks) {
      const runId = `mock-run-${Date.now()}`;
      const traceId = `trace_mock_${Date.now()}`;
      const status: AgentRunStatus = input.mode === 'blocked' || input.mode === 'archived' ? 'blocked' : 'completed';
      const now = nowIso();
      const run: AgentRun = {
        id: runId,
        tenantId: 'mock-tenant',
        workspaceId: 'default',
        assistantId,
        assistantVersionId: 'v1',
        assistantPublicationId: null,
        requestedById: 'mock-user-1',
        status,
        mode: input.mode,
        source: input.source ?? 'assistant_detail',
        inputSummary: input.input.replace(/\s+/g, ' ').trim().slice(0, 500),
        requestId: `req_${runId}`,
        traceId,
        startedAt: status === 'blocked' ? null : now,
        completedAt: status === 'blocked' ? null : now,
        failedAt: null,
        cancelledAt: null,
        blockedAt: status === 'blocked' ? now : null,
        errorCode: status === 'blocked' ? 'MODE_BLOCKED' : null,
        errorMessage: status === 'blocked' ? 'Modo bloqueado para execucao.' : null,
        precheckSnapshot: {
          canExecute: status !== 'blocked',
          mode: input.mode,
          reasons: status === 'blocked' ? [{ code: 'MODE_BLOCKED', message: 'Modo bloqueado para execucao.' }] : [],
          requestId: `req_${runId}`,
        },
        metadata: {
          ...(input.metadata ?? {}),
          runtime: mockRuntimeMetadata(status),
        },
        createdAt: now,
        updatedAt: now,
        events: mockRunEvents(runId, traceId, input.mode, status),
      };
      mockAgentRuns.unshift(run);
      return mockResponse(run);
    }
    const response = await apiClient.post<ApiEnvelope<AgentRun>>(endpoints.assistants.runs(assistantId), {
      ...input,
      source: input.source ?? 'assistant_detail',
    });
    return response.data.data;
  },

  async cancel(runId: string): Promise<AgentRun> {
    if (env.useMocks) {
      const run = await mockFind(mockAgentRuns, runId);
      const now = nowIso();
      const cancelled: AgentRun = {
        ...run,
        status: 'cancelled',
        cancelledAt: now,
        completedAt: null,
        updatedAt: now,
        events: [
          ...(run.events ?? []),
          {
            id: `${runId}-event-${(run.events?.length ?? 0) + 1}`,
            agentRunId: runId,
            type: 'run.cancelled',
            sequence: (run.events?.length ?? 0) + 1,
            status: 'cancelled',
            message: 'Cancelamento registrado pelo control plane.',
            metadata: { traceId: run.traceId },
            createdAt: now,
          },
        ],
      };
      const index = mockAgentRuns.findIndex((item) => item.id === runId);
      if (index >= 0) mockAgentRuns[index] = cancelled;
      return mockResponse(cancelled);
    }
    const response = await apiClient.post<ApiEnvelope<AgentRun>>(endpoints.agentRuns.cancel(runId));
    return response.data.data;
  },
};
