import { getLlmConfig } from './llm.config';
import type { LlmProvider, LlmProviderName, LlmProviderSummary } from './llm.types';
import { agnoLocalLlmProvider, anthropicLlmProvider, azureOpenAiLlmProvider, openAiLlmProvider } from './providers/external-fail-closed-provider';
import { localLlmProvider } from './providers/local-llm-provider';

const providers = new Map<LlmProviderName, LlmProvider>([
  ['local_deterministic', localLlmProvider],
  ['agno_local', agnoLocalLlmProvider],
  ['openai', openAiLlmProvider],
  ['azure_openai', azureOpenAiLlmProvider],
  ['anthropic', anthropicLlmProvider],
]);

export const llmProviderRegistry = {
  currentProvider(): LlmProviderName {
    return getLlmConfig().defaultProvider;
  },

  get(provider?: LlmProviderName): LlmProvider {
    return providers.get(provider ?? this.currentProvider()) ?? localLlmProvider;
  },

  async listProviders(): Promise<LlmProviderSummary[]> {
    const current = this.currentProvider();
    const summaries: LlmProviderSummary[] = [];
    for (const [provider, adapter] of providers.entries()) {
      const [health, capabilities] = await Promise.all([
        adapter.healthCheck(),
        adapter.getCapabilities(),
      ]);
      summaries.push({
        provider,
        current: provider === current,
        health,
        capabilities,
      });
    }
    return summaries;
  },
};
