import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeHealth,
} from './runtime.types';
import { getRuntimeConfig } from './runtime.config';
import { llmService } from '../llm/llm.service';
import type { LlmProviderName } from '../llm/llm.types';

const maxInputPreviewChars = 500;
const maxOutputPreviewChars = 800;

function resolveRuntimeLlmProvider(context: RuntimeExecutionContext): {
  provider: LlmProviderName;
  model?: string | null;
  externalProviderCalled: boolean;
  reason: string;
} {
  const policy = context.llmPolicySnapshot;

  if (context.executionMode === 'sandbox') {
    return {
      provider: 'local_deterministic',
      externalProviderCalled: false,
      reason: 'sandbox_blocks_real_providers',
    };
  }

  if (
    policy.allowExternalLlmProviders &&
    policy.defaultLlmProvider === 'openai' &&
    policy.allowedLlmProviders.includes('openai')
  ) {
    return {
      provider: 'openai',
      model: context.compiledPrompt.modelProvider === 'openai'
        ? context.compiledPrompt.modelName
        : undefined,
      externalProviderCalled: true,
      reason: 'assistant_policy_opt_in',
    };
  }

  return {
    provider: 'local_deterministic',
    externalProviderCalled: false,
    reason: 'assistant_policy_default_local',
  };
}

function actualExternalProviderCalled(
  metadata: unknown,
  selectedExternalProvider: boolean,
) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).externalProviderCalled;
    if (typeof value === 'boolean') return value;
  }
  return selectedExternalProvider;
}

function conversationContextSummary(context: RuntimeExecutionContext) {
  const summary = context.conversationContext?.summary;

  return {
    conversationContextIncluded: Boolean(summary?.included),
    conversationContextMessageCount: summary?.messageCount ?? 0,
    conversationContextChars: summary?.totalChars ?? 0,
    conversationContextTruncated: Boolean(summary?.truncated),
    conversationContextMaxMessages: summary?.maxMessages ?? 0,
    conversationContextMaxMessageChars: summary?.maxMessageChars ?? 0,
    conversationContextMaxTotalChars: summary?.maxTotalChars ?? 0,
  };
}

export class LocalDeterministicRuntimeAdapter implements RuntimeAdapter {
  readonly provider = 'local' as const;

  getCapabilities(): RuntimeCapabilities {
    const config = getRuntimeConfig();
    return {
      provider: this.provider,
      status: config.adapterEnabled ? 'healthy' : 'disabled',
      supportsTextGeneration: 'simulated',
      supportsStreaming: false,
      supportsRagContext: true,
      supportsMcpTools: true,
      supportsToolCalling: 'simulated',
      supportsSandbox: true,
      supportsExternalProviders: false,
      supportsCitations: true,
      supportsTraceEvents: true,
      maxInputPreviewChars,
      maxOutputPreviewChars,
    };
  }

  async healthCheck(): Promise<RuntimeHealth> {
    const config = getRuntimeConfig();
    return {
      provider: this.provider,
      status: config.adapterEnabled ? 'healthy' : 'disabled',
      message: config.adapterEnabled
        ? 'Local deterministic runtime adapter is available.'
        : 'Runtime adapter boundary is disabled by configuration.',
      checkedAt: new Date().toISOString(),
      details: {
        externalProvidersCalled: false,
        externalMcpCalled: false,
        requestTimeoutMs: config.requestTimeoutMs,
      },
    };
  }

  async execute(context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const health = await this.healthCheck();
    if (health.status !== 'healthy') {
      return {
        provider: this.provider,
        status: 'failed',
        message: health.message,
        errorCode: 'RUNTIME_ADAPTER_DISABLED',
        errorMessage: health.message,
        events: [
          {
            type: 'adapter_warning',
            status: 'failed',
            message: health.message,
            metadata: { provider: this.provider, healthStatus: health.status },
          },
          {
            type: 'run_failed',
            status: 'failed',
            message: 'Runtime local nao esta disponivel para executar o run.',
            metadata: { provider: this.provider, runId: context.runId },
          },
        ],
      };
    }

    const llmSelection = resolveRuntimeLlmProvider(context);
    const governedConversationContext = conversationContextSummary(context);

    const llmResult = await llmService.generateForRuntime({
      requestId: context.requestId,
      traceId: context.traceId,
      runId: context.runId,
      provider: llmSelection.provider,
      model: llmSelection.model,
      input: context.input,
      prompt: context.compiledPrompt,
      context: {
        assistantName: context.assistant.name,
        executionMode: context.executionMode,
        ragReady: context.rag.ragReady,
        ragSourceCount: context.rag.sourceReferences.length,
        mcpToolDescriptorCount: context.mcp.allowedSandboxTools.length,
      },
    });

    if (llmResult.status !== 'completed') {
      const externalProviderCalled = actualExternalProviderCalled(
        llmResult.metadata,
        llmSelection.externalProviderCalled,
      );

      return {
        provider: this.provider,
        status: llmResult.status === 'blocked' ? 'blocked' : 'failed',
        message: llmResult.errorMessage ?? llmResult.message,
        errorCode: llmResult.errorCode,
        errorMessage: llmResult.errorMessage,
        metadata: {
          llmProvider: llmResult.provider,
          llmModel: llmResult.model,
          externalProviderCalled,
          llmSelectionReason: llmSelection.reason,
          ...governedConversationContext,
          llm: llmResult.metadata,
        },
        events: [
          {
            type: 'llm_generation_blocked',
            status: llmResult.status === 'blocked' ? 'blocked' : 'failed',
            message: llmResult.errorMessage ?? llmResult.message,
            metadata: {
              llmProvider: llmResult.provider,
              errorCode: llmResult.errorCode,
              inputHash: llmResult.inputHash,
              externalProviderCalled,
              reason: llmSelection.reason,
            },
          },
          {
            type: 'run_failed',
            status: 'failed',
            message: 'Runtime local nao concluiu porque o provider LLM bloqueou a geracao.',
            metadata: { provider: this.provider, runId: context.runId },
          },
        ],
      };
    }

    const outputPreview = llmResult.outputPreview ?? '';

    return {
      provider: this.provider,
      status: 'completed',
      outputPreview: outputPreview.slice(0, maxOutputPreviewChars),
      outputHash: llmResult.outputHash,
      message: llmSelection.externalProviderCalled
        ? 'Runtime local concluiu a execucao usando provider LLM externo governado.'
        : 'Runtime local deterministico concluiu a execucao sem provider externo.',
      metadata: {
        llmProvider: llmResult.provider,
        llmModel: llmResult.model,
        llmLatencyMs: llmResult.latencyMs,
        externalProviderCalled: llmSelection.externalProviderCalled,
        llmSelectionReason: llmSelection.reason,
        ...governedConversationContext,
        llm: llmResult.metadata,
      },
      events: [
        {
          type: 'provider_selected',
          status: 'running',
          message: 'Runtime provider local selecionado pelo registry.',
          metadata: {
            provider: this.provider,
            mode: context.executionMode,
            traceId: context.traceId,
          },
        },
        {
          type: 'llm_provider_selected',
          status: 'running',
          message: llmSelection.externalProviderCalled
            ? 'LLM provider externo selecionado por policy governada do assistant.'
            : 'LLM provider local deterministico selecionado pelo runtime local.',
          metadata: {
            llmProvider: llmResult.provider,
            model: llmResult.model,
            externalProviderCalled: llmSelection.externalProviderCalled,
            reason: llmSelection.reason,
          },
        },
        {
          type: 'run_started',
          status: 'running',
          message: 'Runtime adapter local recebeu contexto governado.',
          metadata: {
            provider: this.provider,
            mode: context.executionMode,
            traceId: context.traceId,
          },
        },
        {
          type: 'prompt_compiled',
          status: 'running',
          message: 'Prompt placeholder anexado ao contexto de execucao.',
          metadata: context.compiledPrompt,
        },
        {
          type: 'rag_context_attached',
          status: 'running',
          message: 'Resumo RAG governado anexado sem retrieval semantico.',
          metadata: {
            ragReady: context.rag.ragReady,
            knowledgeBindingsCount: context.rag.knowledgeBindingsCount,
            chunkCount: context.rag.chunkCount,
            sourceReferenceCount: context.rag.sourceReferenceCount,
            lastRagQueryId: context.rag.lastRagQueryId,
          },
        },
        {
          type: 'mcp_tools_attached',
          status: 'running',
          message: 'Resumo MCP sandbox anexado sem chamada externa.',
          metadata: {
            mcpBindingsCount: context.mcp.mcpBindingsCount,
            allowedSandboxTools: context.mcp.allowedSandboxTools.length,
            blockedTools: context.mcp.blockedTools.length,
            requiresApproval: context.mcp.requiresApproval.length,
            lastToolCallIds: context.mcp.lastToolCallIds,
          },
        },
        {
          type: 'runtime_llm_context_attached',
          status: 'running',
          message: 'Contexto LLM sanitizado anexado ao runtime sem prompt bruto.',
          metadata: {
            inputHash: context.input.hash,
            inputPreviewChars: context.input.preview.length,
            instructionPreviewChars: context.compiledPrompt.instructionsPreview?.length ?? 0,
            rawPromptStored: false,
            rawOutputStored: false,
            ...governedConversationContext,
          },
        },
        {
          type: 'llm_generation_started',
          status: 'running',
          message: llmSelection.externalProviderCalled
            ? 'Geracao LLM externa governada iniciada.'
            : 'Geracao LLM local iniciada.',
          metadata: {
            simulated: !llmSelection.externalProviderCalled,
            externalProvidersCalled: llmSelection.externalProviderCalled,
            llmProvider: llmSelection.provider,
            inputHash: context.input.hash,
          },
        },
        {
          type: 'llm_generation_completed',
          status: 'completed',
          message: llmSelection.externalProviderCalled
            ? 'Geracao LLM externa governada concluida.'
            : 'Geracao LLM local concluida.',
          metadata: {
            simulated: !llmSelection.externalProviderCalled,
            externalProvidersCalled: llmSelection.externalProviderCalled,
            llmProvider: llmResult.provider,
            model: llmResult.model,
            outputHash: llmResult.outputHash,
            latencyMs: llmResult.latencyMs,
          },
        },
        {
          type: 'model_completed',
          status: 'completed',
          message: llmSelection.externalProviderCalled
            ? 'Modelo externo concluiu resposta governada.'
            : 'Modelo simulado concluiu resposta deterministica.',
          metadata: {
            simulated: !llmSelection.externalProviderCalled,
            externalProvidersCalled: llmSelection.externalProviderCalled,
            llmProvider: llmResult.provider,
            model: llmResult.model,
            outputHash: llmResult.outputHash,
          },
        },
        {
          type: 'run_completed',
          status: 'completed',
          message: 'Run finalizado pelo adapter local deterministico.',
          metadata: {
            provider: this.provider,
            runId: context.runId,
          },
        },
      ],
    };
  }

  async cancel(input: { runId: string; traceId: string }): Promise<RuntimeExecutionResult> {
    return {
      provider: this.provider,
      status: 'cancelled',
      message: 'Cancelamento registrado no adapter local.',
      events: [
        {
          type: 'adapter_warning',
          status: 'cancelled',
          message: 'Cancelamento local nao acionou processo externo.',
          metadata: {
            runId: input.runId,
            traceId: input.traceId,
            provider: this.provider,
          },
        },
      ],
    };
  }
}

export const localDeterministicRuntimeAdapter = new LocalDeterministicRuntimeAdapter();
