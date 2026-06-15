import type { AgentRunEventInput } from '../agent-runs/agent-runs.types';
import type { RuntimeExecutionResult, RuntimeNormalizedEvent } from './runtime.types';

const eventTypeMap: Record<RuntimeNormalizedEvent['type'], string> = {
  provider_selected: 'runtime.provider_selected',
  run_started: 'runtime.run_started',
  prompt_compiled: 'runtime.prompt_compiled',
  rag_context_attached: 'runtime.rag_context_attached',
  mcp_tools_attached: 'runtime.mcp_tools_attached',
  llm_provider_selected: 'llm.provider_selected',
  llm_generation_started: 'llm.generation_started',
  llm_generation_completed: 'llm.generation_completed',
  llm_generation_failed: 'llm.generation_failed',
  llm_generation_blocked: 'llm.generation_blocked',
  runtime_llm_context_attached: 'runtime.llm_context_attached',
  agno_health_checked: 'agno.health_checked',
  agno_request_started: 'agno.request_started',
  agno_request_completed: 'agno.request_completed',
  agno_request_failed: 'agno.request_failed',
  model_started: 'runtime.model_started',
  model_completed: 'runtime.model_completed',
  run_completed: 'runtime.run_completed',
  run_failed: 'runtime.run_failed',
  adapter_warning: 'runtime.adapter_warning',
};

export function normalizeRuntimeEvents(result: RuntimeExecutionResult): AgentRunEventInput[] {
  return result.events.map((event) => ({
    type: eventTypeMap[event.type],
    status: event.status,
    message: event.message,
    metadata: {
      provider: result.provider,
      ...((typeof event.metadata === 'object' && event.metadata) ? event.metadata : {}),
    },
  }));
}
