import { createHash } from 'node:crypto';
import { getLlmConfig } from '../llm.config';
import type {
  LlmGenerateTextRequest,
  LlmGenerateTextResult,
  LlmProvider,
  LlmProviderCapabilities,
  LlmProviderHealth,
} from '../llm.types';

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export class LocalLlmProvider implements LlmProvider {
  readonly provider = 'local_deterministic' as const;

  getCapabilities(): LlmProviderCapabilities {
    const config = getLlmConfig();
    return {
      provider: this.provider,
      status: 'healthy',
      enabled: true,
      configured: true,
      executionEnabled: true,
      supportsChatCompletion: 'simulated',
      supportsStreaming: false,
      supportsToolCalling: false,
      supportsStructuredOutput: 'planned',
      supportsEmbeddings: false,
      supportsRagContext: true,
      supportsMcpContext: true,
      secretsConfigured: false,
      models: ['local-deterministic-v1'],
      defaultModel: 'local-deterministic-v1',
      maxInputPreviewChars: config.maxInputPreviewChars,
      maxOutputPreviewChars: config.maxOutputPreviewChars,
    };
  }

  async healthCheck(): Promise<LlmProviderHealth> {
    return {
      provider: this.provider,
      status: 'healthy',
      message: 'Local deterministic LLM provider is available without external credentials.',
      checkedAt: new Date().toISOString(),
      details: {
        externalProviderCalled: false,
        secretsRequired: false,
      },
    };
  }

  async generateText(request: LlmGenerateTextRequest): Promise<LlmGenerateTextResult> {
    const startedAt = Date.now();
    const config = getLlmConfig();
    const output = [
      'Resposta deterministica local do Orchestra.',
      `Assistant: ${request.context?.assistantName ?? 'unknown'}.`,
      `Modo: ${request.context?.executionMode ?? 'unknown'}.`,
      `RAG pronto: ${request.context?.ragReady ? 'sim' : 'nao'}.`,
      `Fontes RAG anexadas: ${request.context?.ragSourceCount ?? 0}.`,
      `Descriptors MCP anexados: ${request.context?.mcpToolDescriptorCount ?? 0}.`,
      `Mensagens de contexto conversacional: ${request.conversationContext?.summary.messageCount ?? 0}.`,
      `Input hash: ${request.input.hash.slice(0, 12)}.`,
    ].join(' ');

    return {
      provider: this.provider,
      status: 'completed',
      message: 'LLM provider local deterministico concluiu a geracao sem chamada externa.',
      model: 'local-deterministic-v1',
      outputPreview: output.slice(0, config.maxOutputPreviewChars),
      outputHash: hashText(output),
      inputHash: request.input.hash,
      latencyMs: Date.now() - startedAt,
      metadata: {
        simulated: true,
        externalProviderCalled: false,
        rawPromptStored: false,
        rawOutputStored: false,
        conversationContextIncluded: Boolean(request.conversationContext?.summary.included),
        conversationContextMessageCount: request.conversationContext?.summary.messageCount ?? 0,
        conversationContextChars: request.conversationContext?.summary.totalChars ?? 0,
        conversationContextTruncated: Boolean(request.conversationContext?.summary.truncated),
      },
    };
  }
}

export const localLlmProvider = new LocalLlmProvider();
