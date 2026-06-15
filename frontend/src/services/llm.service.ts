import type { LlmConfig, LlmProviderCapabilities, LlmProviderHealth, LlmProviderSummary } from '@/types';
import { env } from '@/lib/env';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type ApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const nowIso = () => new Date().toISOString();

const localCapabilities: LlmProviderCapabilities = {
  provider: 'local_deterministic',
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
  maxInputPreviewChars: 500,
  maxOutputPreviewChars: 800,
};

const externalCapabilities = (provider: 'agno_local' | 'openai' | 'azure_openai' | 'anthropic'): LlmProviderCapabilities => ({
  provider,
  status: 'disabled',
  enabled: false,
  configured: false,
  executionEnabled: false,
  supportsChatCompletion: 'planned_but_disabled',
  supportsStreaming: 'planned_but_disabled',
  supportsToolCalling: 'planned_but_disabled',
  supportsStructuredOutput: 'planned',
  supportsEmbeddings: 'planned',
  supportsRagContext: 'planned',
  supportsMcpContext: 'planned_but_disabled',
  secretsConfigured: false,
  models: [],
  defaultModel: null,
  maxInputPreviewChars: 500,
  maxOutputPreviewChars: 800,
});

const health = (provider: LlmProviderCapabilities['provider'], status: LlmProviderHealth['status'], message: string): LlmProviderHealth => ({
  provider,
  status,
  message,
  checkedAt: nowIso(),
  details: { externalHttpCalled: false },
});

const mockConfig: LlmConfig = {
  providersEnabled: false,
  defaultProvider: 'local_deterministic',
  executionEnabled: false,
  providerTimeoutMs: 30000,
  maxInputPreviewChars: 500,
  maxOutputPreviewChars: 800,
  storeRawPrompts: false,
  storeRawOutputs: false,
  openaiEnabled: false,
  openaiConfigured: false,
  openaiExecutionEnabled: false,
  openaiBaseUrlConfigured: true,
  openaiDefaultModelConfigured: false,
  azureOpenaiEnabled: false,
  azureOpenaiConfigured: false,
  azureOpenaiExecutionEnabled: false,
  azureOpenaiEndpointConfigured: false,
  azureOpenaiDeploymentConfigured: false,
  azureOpenaiApiVersionConfigured: false,
  anthropicEnabled: false,
  anthropicConfigured: false,
  anthropicExecutionEnabled: false,
  anthropicBaseUrlConfigured: true,
  anthropicDefaultModelConfigured: false,
  agnoLocalEnabled: false,
  agnoLocalConfigured: true,
  agnoLocalExecutionEnabled: false,
};

const mockProviders = (): LlmProviderSummary[] => [
  {
    provider: 'local_deterministic',
    current: true,
    health: health('local_deterministic', 'healthy', 'Local deterministic LLM provider is available without external credentials.'),
    capabilities: localCapabilities,
  },
  {
    provider: 'agno_local',
    current: false,
    health: health('agno_local', 'disabled', 'Agno local provider is disabled by configuration.'),
    capabilities: externalCapabilities('agno_local'),
  },
  {
    provider: 'openai',
    current: false,
    health: health('openai', 'disabled', 'OpenAI provider is disabled by configuration.'),
    capabilities: externalCapabilities('openai'),
  },
  {
    provider: 'azure_openai',
    current: false,
    health: health('azure_openai', 'disabled', 'Azure OpenAI provider is disabled by configuration.'),
    capabilities: externalCapabilities('azure_openai'),
  },
  {
    provider: 'anthropic',
    current: false,
    health: health('anthropic', 'disabled', 'Anthropic provider is disabled by configuration.'),
    capabilities: externalCapabilities('anthropic'),
  },
];

export const llmService = {
  async providers(): Promise<LlmProviderSummary[]> {
    if (env.useMocks) return mockResponse(mockProviders());
    const response = await apiClient.get<ApiEnvelope<LlmProviderSummary[]>>(endpoints.llm.providers);
    return response.data.data;
  },

  async config(): Promise<LlmConfig> {
    if (env.useMocks) return mockResponse(mockConfig);
    const response = await apiClient.get<ApiEnvelope<LlmConfig>>(endpoints.llm.config);
    return response.data.data;
  },
};
