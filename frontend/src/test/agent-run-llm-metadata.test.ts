import { describe, expect, it } from 'vitest';
import type { AgentRun, AgentRunEvent } from '@/types';
import {
  getAgentRunEventLlmSummary,
  getAgentRunLlmSummary,
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

const event = (type: string, sequence: number, metadata: AgentRunEvent['metadata']): AgentRunEvent => ({
  id: `event-${sequence}`,
  agentRunId: 'run-1',
  type,
  sequence,
  status: 'completed',
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
