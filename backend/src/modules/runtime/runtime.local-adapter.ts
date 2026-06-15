import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeHealth,
} from './runtime.types';
import { getRuntimeConfig } from './runtime.config';

const maxInputPreviewChars = 500;
const maxOutputPreviewChars = 800;

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

    const outputPreview = `Resposta simulada gerada pelo runtime local do Orchestra para validar o boundary de execucao. Assistant "${context.assistant.name}" executado em modo ${context.executionMode}.`;

    return {
      provider: this.provider,
      status: 'completed',
      outputPreview: outputPreview.slice(0, maxOutputPreviewChars),
      message: 'Runtime local deterministico concluiu a execucao sem provider externo.',
      events: [
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
          type: 'model_started',
          status: 'running',
          message: 'Modelo simulado iniciado no adapter local.',
          metadata: {
            simulated: true,
            externalProvidersCalled: false,
            inputHash: context.input.hash,
          },
        },
        {
          type: 'model_completed',
          status: 'completed',
          message: 'Modelo simulado concluiu resposta deterministica.',
          metadata: {
            simulated: true,
            outputPreview: outputPreview.slice(0, 180),
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
