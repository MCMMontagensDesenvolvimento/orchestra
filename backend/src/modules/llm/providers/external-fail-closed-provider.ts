import { getLlmConfig, type LlmFeatureConfig } from '../llm.config';
import type {
  LlmGenerateTextRequest,
  LlmGenerateTextResult,
  LlmProvider,
  LlmProviderCapabilities,
  LlmProviderHealth,
  LlmProviderName,
  LlmProviderStatus,
} from '../llm.types';

interface ExternalProviderOptions {
  provider: Exclude<LlmProviderName, 'local_deterministic'>;
  label: string;
  enabled: (config: LlmFeatureConfig) => boolean;
  configured: (config: LlmFeatureConfig) => boolean;
  executionEnabled: (config: LlmFeatureConfig) => boolean;
  secretsConfigured: (config: LlmFeatureConfig) => boolean;
  defaultModel: (config: LlmFeatureConfig) => string | null;
  models: (config: LlmFeatureConfig) => string[];
  details: (config: LlmFeatureConfig) => Record<string, unknown>;
}

function providerStatus(options: ExternalProviderOptions, config: LlmFeatureConfig): LlmProviderStatus {
  if (!options.enabled(config)) return 'disabled';
  if (!options.configured(config)) return 'misconfigured';
  if (!config.executionEnabled || !options.executionEnabled(config)) return 'configured_but_execution_disabled';
  return 'configured_but_execution_disabled';
}

function statusMessage(options: ExternalProviderOptions, status: LlmProviderStatus) {
  if (status === 'disabled') return `${options.label} provider is disabled by configuration.`;
  if (status === 'misconfigured') return `${options.label} provider is enabled but missing required backend-only configuration.`;
  if (status === 'configured_but_execution_disabled') return `${options.label} provider is configured, but external LLM execution is disabled or planned-only in this phase.`;
  return `${options.label} provider is unavailable.`;
}

export class ExternalFailClosedLlmProvider implements LlmProvider {
  readonly provider: LlmProviderName;

  constructor(private readonly options: ExternalProviderOptions) {
    this.provider = options.provider;
  }

  getCapabilities(): LlmProviderCapabilities {
    const config = getLlmConfig();
    const status = providerStatus(this.options, config);
    const configured = this.options.configured(config);
    const executionEnabled = config.executionEnabled && this.options.executionEnabled(config) && status === 'healthy';
    return {
      provider: this.provider,
      status,
      enabled: this.options.enabled(config),
      configured,
      executionEnabled,
      supportsChatCompletion: status === 'disabled' ? 'planned_but_disabled' : 'planned',
      supportsStreaming: 'planned_but_disabled',
      supportsToolCalling: 'planned_but_disabled',
      supportsStructuredOutput: 'planned',
      supportsEmbeddings: 'planned',
      supportsRagContext: 'planned',
      supportsMcpContext: 'planned_but_disabled',
      secretsConfigured: this.options.secretsConfigured(config),
      models: this.options.models(config),
      defaultModel: this.options.defaultModel(config),
      maxInputPreviewChars: config.maxInputPreviewChars,
      maxOutputPreviewChars: config.maxOutputPreviewChars,
    };
  }

  async healthCheck(): Promise<LlmProviderHealth> {
    const config = getLlmConfig();
    const status = providerStatus(this.options, config);
    return {
      provider: this.provider,
      status,
      message: statusMessage(this.options, status),
      checkedAt: new Date().toISOString(),
      details: {
        ...this.options.details(config),
        externalHttpCalled: false,
      },
    };
  }

  async generateText(request: LlmGenerateTextRequest): Promise<LlmGenerateTextResult> {
    const health = await this.healthCheck();
    return {
      provider: this.provider,
      status: 'blocked',
      message: health.message,
      model: this.getCapabilities().defaultModel,
      inputHash: request.input.hash,
      latencyMs: 0,
      errorCode: health.status === 'misconfigured' ? 'LLM_PROVIDER_MISCONFIGURED' : 'LLM_PROVIDER_EXECUTION_BLOCKED',
      errorMessage: health.message,
      metadata: {
        providerStatus: health.status,
        externalHttpCalled: false,
        rawPromptStored: false,
        rawOutputStored: false,
      },
    };
  }
}

export const agnoLocalLlmProvider = new ExternalFailClosedLlmProvider({
  provider: 'agno_local',
  label: 'Agno local',
  enabled: (config) => config.agnoLocalEnabled,
  configured: (config) => config.agnoLocalConfigured,
  executionEnabled: (config) => config.agnoLocalExecutionEnabled,
  secretsConfigured: () => false,
  defaultModel: () => 'agno-local-runtime',
  models: (config) => (config.agnoLocalConfigured ? ['agno-local-runtime'] : []),
  details: (config) => ({
    agnoLocalEnabled: config.agnoLocalEnabled,
    agnoLocalConfigured: config.agnoLocalConfigured,
    agnoLocalExecutionEnabled: config.agnoLocalExecutionEnabled,
  }),
});

export const openAiLlmProvider = new ExternalFailClosedLlmProvider({
  provider: 'openai',
  label: 'OpenAI',
  enabled: (config) => config.providersEnabled && config.openaiEnabled,
  configured: (config) => config.openaiConfigured,
  executionEnabled: (config) => config.openaiExecutionEnabled,
  secretsConfigured: (config) => config.openaiConfigured,
  defaultModel: (config) => config.openaiDefaultModel,
  models: (config) => (config.openaiDefaultModel ? [config.openaiDefaultModel] : []),
  details: (config) => ({
    providersEnabled: config.providersEnabled,
    openaiEnabled: config.openaiEnabled,
    openaiBaseUrlConfigured: config.openaiBaseUrlConfigured,
    openaiDefaultModelConfigured: Boolean(config.openaiDefaultModel),
  }),
});

export const azureOpenAiLlmProvider = new ExternalFailClosedLlmProvider({
  provider: 'azure_openai',
  label: 'Azure OpenAI',
  enabled: (config) => config.providersEnabled && config.azureOpenaiEnabled,
  configured: (config) => config.azureOpenaiConfigured,
  executionEnabled: (config) => config.azureOpenaiExecutionEnabled,
  secretsConfigured: (config) => config.azureOpenaiConfigured,
  defaultModel: (config) => config.azureOpenaiDeployment,
  models: (config) => (config.azureOpenaiDeployment ? [config.azureOpenaiDeployment] : []),
  details: (config) => ({
    providersEnabled: config.providersEnabled,
    azureOpenaiEnabled: config.azureOpenaiEnabled,
    azureOpenaiEndpointConfigured: config.azureOpenaiEndpointConfigured,
    azureOpenaiDeploymentConfigured: config.azureOpenaiDeploymentConfigured,
    azureOpenaiApiVersionConfigured: config.azureOpenaiApiVersionConfigured,
  }),
});

export const anthropicLlmProvider = new ExternalFailClosedLlmProvider({
  provider: 'anthropic',
  label: 'Anthropic',
  enabled: (config) => config.providersEnabled && config.anthropicEnabled,
  configured: (config) => config.anthropicConfigured,
  executionEnabled: (config) => config.anthropicExecutionEnabled,
  secretsConfigured: (config) => config.anthropicConfigured,
  defaultModel: (config) => config.anthropicDefaultModel,
  models: (config) => (config.anthropicDefaultModel ? [config.anthropicDefaultModel] : []),
  details: (config) => ({
    providersEnabled: config.providersEnabled,
    anthropicEnabled: config.anthropicEnabled,
    anthropicBaseUrlConfigured: config.anthropicBaseUrlConfigured,
    anthropicDefaultModelConfigured: Boolean(config.anthropicDefaultModel),
  }),
});
