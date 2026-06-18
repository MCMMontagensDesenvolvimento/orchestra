import { describe, expect, it } from 'vitest';
import type { AgentRun, AgentRunEvent } from '@/types';
import {
  getAgentRunEventLlmSummary,
  getAgentRunEventPresentation,
  getAgentRunLlmSummary,
  llmSelectionReasonLabel,
  safeAgentRunEventMessage,
  visibleAgentRunEvents,
} from '@/lib/agent-run-llm-metadata';

const baseRun = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: 'run-1',
  tenantId: 'tenant-1',
  workspaceId: 'workspace-1',
  assistantId: 'assistant-1',
  requestedById: 'user-1',
  status: 'completed',
  mode: 'published',
  source: 'test',
  traceId: 'trace-1',
  createdAt: '2026-06-18T12:00:00.000Z',
  updatedAt: '2026-06-18T12:00:01.000Z',
  ...overrides,
});

const event = (
  type: string,
  sequence: number,
  metadata: AgentRunEvent['metadata'],
  status: AgentRunEvent['status'] = 'completed',
): AgentRunEvent => ({
  id: `event-${sequence}`,
  agentRunId: 'run-1',
  type,
  sequence,
  status,
  metadata,
  createdAt: '2026-06-18T12:00:00.000Z',
});

describe('agent run LLM metadata', () => {
  it('normalizes OpenAI provider, model, latency and numeric token usage from run metadata', () => {
    const summary = getAgentRunLlmSummary(baseRun({
      metadata: {
        runtime: {
          provider: 'local',
          status: 'completed',
          adapterMetadata: {
            llmProvider: 'openai',
            llmModel: 'gpt-4.1-mini',
            llmLatencyMs: 842,
            externalProviderCalled: true,
            llmSelectionReason: 'assistant_policy_opt_in',
            llm: {
              provider: 'openai',
              externalProviderCalled: true,
              inputTokens: 120,
              outputTokens: 30,
              totalTokens: 150,
            },
          },
        },
      },
    }));

    expect(summary).toMatchObject({
      runtimeProvider: 'local',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      externalProviderCalled: true,
      selectionReason: 'assistant_policy_opt_in',
      latencyMs: 842,
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
    });
  });

  it('prefers the actual provider call flag when a selected external provider fails closed', () => {
    const summary = getAgentRunLlmSummary(baseRun({
      status: 'failed',
      metadata: {
        runtime: {
          provider: 'local',
          status: 'failed',
          adapterMetadata: {
            llmProvider: 'openai',
            externalProviderCalled: true,
            llmSelectionReason: 'assistant_policy_opt_in',
            llm: {
              provider: 'openai',
              externalProviderCalled: false,
              failedClosed: true,
              providerStatus: 'configured_but_execution_disabled',
            },
          },
        },
      },
    }));

    expect(summary.externalProviderCalled).toBe(false);
    expect(summary.failedClosed).toBe(true);
    expect(summary.providerStatus).toBe('configured_but_execution_disabled');
  });

  it('uses sanitized event metadata as a fallback for old runs without runtime metadata', () => {
    const summary = getAgentRunLlmSummary(baseRun({
      metadata: null,
      events: [
        event('runtime.provider_selected', 1, { provider: 'local' }),
        event('llm.provider_selected', 2, {
          provider: 'local',
          llmProvider: 'local_deterministic',
          model: 'local-deterministic-v1',
          externalProviderCalled: false,
          reason: 'sandbox_blocks_real_providers',
        }),
        event('llm.generation_completed', 3, {
          provider: 'local',
          llmProvider: 'local_deterministic',
          latencyMs: 9,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        }),
      ],
    }));

    expect(summary).toMatchObject({
      runtimeProvider: 'local',
      provider: 'local_deterministic',
      model: 'local-deterministic-v1',
      externalProviderCalled: false,
      selectionReason: 'sandbox_blocks_real_providers',
      latencyMs: 9,
      totalTokens: 0,
    });
  });

  it('never exposes raw event messages or non-allowlisted metadata in LLM details', () => {
    const unsafeEvent = {
      ...event('llm.generation_failed', 1, {
        provider: 'local',
        llmProvider: 'openai',
        prompt: 'raw prompt',
        output: 'raw output',
        authorization: 'Bearer secret',
      }),
      message: 'Internal upstream response body.',
    };

    const summary = getAgentRunEventLlmSummary(unsafeEvent);
    expect(safeAgentRunEventMessage(unsafeEvent)).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain('raw prompt');
    expect(JSON.stringify(summary)).not.toContain('raw output');
    expect(JSON.stringify(summary)).not.toContain('Bearer secret');
  });

  it.each([
    ['llm.provider_selected', 'Provider LLM selecionado', 'info'],
    ['llm.generation_started', 'Geração LLM iniciada', 'info'],
    ['llm.generation_completed', 'Geração LLM concluída', 'success'],
    ['llm.generation_failed', 'Geração LLM falhou', 'danger'],
    ['llm.generation_blocked', 'Geração LLM bloqueada', 'warning'],
    ['runtime.provider_selected', 'Runtime selecionado', 'info'],
    ['runtime.model_started', 'Modelo iniciado', 'info'],
    ['runtime.model_completed', 'Modelo finalizado', 'success'],
    ['runtime.run_completed', 'Run concluído', 'success'],
    ['runtime.run_failed', 'Run falhou no runtime', 'danger'],
    ['run.blocked', 'Run bloqueado', 'warning'],
    ['run.failed', 'Run falhou', 'danger'],
    ['run.completed', 'Run concluído', 'success'],
  ])('maps %s to a friendly timeline label', (type, label, tone) => {
    expect(getAgentRunEventPresentation(event(type, 1, {}))).toEqual({ label, tone });
  });

  it('uses a safe status-based label for unknown legacy events', () => {
    expect(getAgentRunEventPresentation(event('legacy.internal_step', 1, {}, 'running'))).toEqual({
      label: 'Evento em andamento',
      tone: 'info',
    });
  });

  it('maps governance reasons without exposing arbitrary metadata', () => {
    expect(llmSelectionReasonLabel('sandbox_blocks_real_providers')).toBe('Sandbox bloqueou provider real');
    expect(llmSelectionReasonLabel('assistant_policy_opt_in')).toBe('Provider selecionado por policy');
    expect(llmSelectionReasonLabel('provider_fallback_local')).toBe('Fallback local_deterministic');
    expect(llmSelectionReasonLabel('policy_blocked_external')).toBe('Policy bloqueou provider real');
  });

  it('keeps fail-closed and simulated flags while allowing only numeric usage', () => {
    const summary = getAgentRunEventLlmSummary(event('llm.generation_blocked', 1, {
      llmProvider: 'openai',
      providerStatus: 'disabled',
      externalProviderCalled: false,
      failedClosed: true,
      simulated: true,
      inputTokens: 10,
      outputTokens: 'not-a-number',
      totalTokens: 10,
    }));

    expect(summary).toMatchObject({
      provider: 'openai',
      providerStatus: 'disabled',
      externalProviderCalled: false,
      failedClosed: true,
      simulated: true,
      inputTokens: 10,
      totalTokens: 10,
    });
    expect(summary.outputTokens).toBeUndefined();
  });

  it('shows messages only for explicitly safe control-plane events', () => {
    const safeEvent = {
      ...event('runtime.run_completed', 1, {}),
      message: 'Run concluído pelo runtime local.',
    };
    const failedEvent = {
      ...event('runtime.run_failed', 2, {}),
      message: 'Upstream response body.',
    };

    expect(safeAgentRunEventMessage(safeEvent)).toBe('Run concluído pelo runtime local.');
    expect(safeAgentRunEventMessage(failedEvent)).toBeUndefined();
  });

  it('prioritizes provider and model events in the compact timeline', () => {
    const events = [
      event('run.requested', 1, {}),
      event('runtime.prompt_compiled', 2, {}),
      event('llm.provider_selected', 3, { llmProvider: 'openai' }),
      event('llm.generation_completed', 4, { llmProvider: 'openai', latencyMs: 100 }),
      event('runtime.run_completed', 5, { provider: 'local' }),
    ];

    expect(visibleAgentRunEvents(events).map((item) => item.type)).toEqual([
      'llm.provider_selected',
      'llm.generation_completed',
      'runtime.run_completed',
    ]);
  });
});
