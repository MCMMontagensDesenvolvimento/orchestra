import type { LlmFeatureConfig } from './llm.config';
import type { LlmGenerateTextResult, LlmProviderCapabilities, LlmProviderHealth, LlmProviderSummary } from './llm.types';

export function mapLlmConfig(config: LlmFeatureConfig) {
  return {
    providersEnabled: config.providersEnabled,
    defaultProvider: config.defaultProvider,
    executionEnabled: config.executionEnabled,
    providerTimeoutMs: config.providerTimeoutMs,
    maxInputPreviewChars: config.maxInputPreviewChars,
    maxOutputPreviewChars: config.maxOutputPreviewChars,
    storeRawPrompts: config.storeRawPrompts,
    storeRawOutputs: config.storeRawOutputs,
    openaiEnabled: config.openaiEnabled,
    openaiConfigured: config.openaiConfigured,
    openaiExecutionEnabled: config.openaiExecutionEnabled,
    openaiBaseUrlConfigured: config.openaiBaseUrlConfigured,
    openaiDefaultModelConfigured: Boolean(config.openaiDefaultModel),
    azureOpenaiEnabled: config.azureOpenaiEnabled,
    azureOpenaiConfigured: config.azureOpenaiConfigured,
    azureOpenaiExecutionEnabled: config.azureOpenaiExecutionEnabled,
    azureOpenaiEndpointConfigured: config.azureOpenaiEndpointConfigured,
    azureOpenaiDeploymentConfigured: config.azureOpenaiDeploymentConfigured,
    azureOpenaiApiVersionConfigured: config.azureOpenaiApiVersionConfigured,
    anthropicEnabled: config.anthropicEnabled,
    anthropicConfigured: config.anthropicConfigured,
    anthropicExecutionEnabled: config.anthropicExecutionEnabled,
    anthropicBaseUrlConfigured: config.anthropicBaseUrlConfigured,
    anthropicDefaultModelConfigured: Boolean(config.anthropicDefaultModel),
    agnoLocalEnabled: config.agnoLocalEnabled,
    agnoLocalConfigured: config.agnoLocalConfigured,
    agnoLocalExecutionEnabled: config.agnoLocalExecutionEnabled,
  };
}

export function mapLlmProvider(provider: LlmProviderSummary) {
  return provider;
}

export function mapLlmHealth(health: LlmProviderHealth) {
  return health;
}

export function mapLlmCapabilities(capabilities: LlmProviderCapabilities) {
  return capabilities;
}

export function mapLlmGenerationResult(result: LlmGenerateTextResult) {
  return {
    provider: result.provider,
    status: result.status,
    message: result.message,
    model: result.model,
    outputPreview: result.outputPreview,
    outputHash: result.outputHash,
    inputHash: result.inputHash,
    latencyMs: result.latencyMs,
    metadata: result.metadata,
  };
}
