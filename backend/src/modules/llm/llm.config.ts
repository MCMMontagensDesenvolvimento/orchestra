import { env } from '../../config/env';
import type { LlmProviderName } from './llm.types';

export interface LlmFeatureConfig {
  providersEnabled: boolean;
  defaultProvider: LlmProviderName;
  executionEnabled: boolean;
  providerTimeoutMs: number;
  maxInputPreviewChars: number;
  maxOutputPreviewChars: number;
  storeRawPrompts: boolean;
  storeRawOutputs: boolean;
  openaiEnabled: boolean;
  openaiConfigured: boolean;
  openaiExecutionEnabled: boolean;
  openaiBaseUrlConfigured: boolean;
  openaiDefaultModel: string | null;
  azureOpenaiEnabled: boolean;
  azureOpenaiConfigured: boolean;
  azureOpenaiExecutionEnabled: boolean;
  azureOpenaiEndpointConfigured: boolean;
  azureOpenaiDeploymentConfigured: boolean;
  azureOpenaiApiVersionConfigured: boolean;
  azureOpenaiDeployment: string | null;
  anthropicEnabled: boolean;
  anthropicConfigured: boolean;
  anthropicExecutionEnabled: boolean;
  anthropicBaseUrlConfigured: boolean;
  anthropicDefaultModel: string | null;
  agnoLocalEnabled: boolean;
  agnoLocalConfigured: boolean;
  agnoLocalExecutionEnabled: boolean;
}

export function getLlmConfig(): LlmFeatureConfig {
  return {
    providersEnabled: env.LLM_PROVIDERS_ENABLED,
    defaultProvider: env.LLM_DEFAULT_PROVIDER,
    executionEnabled: env.LLM_EXECUTION_ENABLED,
    providerTimeoutMs: env.LLM_PROVIDER_TIMEOUT_MS,
    maxInputPreviewChars: env.LLM_MAX_INPUT_PREVIEW_CHARS,
    maxOutputPreviewChars: env.LLM_MAX_OUTPUT_PREVIEW_CHARS,
    storeRawPrompts: env.LLM_STORE_RAW_PROMPTS,
    storeRawOutputs: env.LLM_STORE_RAW_OUTPUTS,
    openaiEnabled: env.OPENAI_ENABLED,
    openaiConfigured: Boolean(env.OPENAI_API_KEY && env.OPENAI_DEFAULT_MODEL),
    openaiExecutionEnabled: env.OPENAI_EXECUTION_ENABLED,
    openaiBaseUrlConfigured: Boolean(env.OPENAI_BASE_URL),
    openaiDefaultModel: env.OPENAI_DEFAULT_MODEL ?? null,
    azureOpenaiEnabled: env.AZURE_OPENAI_ENABLED,
    azureOpenaiConfigured: Boolean(
      env.AZURE_OPENAI_ENDPOINT
      && env.AZURE_OPENAI_API_KEY
      && env.AZURE_OPENAI_DEPLOYMENT
      && env.AZURE_OPENAI_API_VERSION,
    ),
    azureOpenaiExecutionEnabled: env.AZURE_OPENAI_EXECUTION_ENABLED,
    azureOpenaiEndpointConfigured: Boolean(env.AZURE_OPENAI_ENDPOINT),
    azureOpenaiDeploymentConfigured: Boolean(env.AZURE_OPENAI_DEPLOYMENT),
    azureOpenaiApiVersionConfigured: Boolean(env.AZURE_OPENAI_API_VERSION),
    azureOpenaiDeployment: env.AZURE_OPENAI_DEPLOYMENT ?? null,
    anthropicEnabled: env.ANTHROPIC_ENABLED,
    anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY && env.ANTHROPIC_DEFAULT_MODEL),
    anthropicExecutionEnabled: env.ANTHROPIC_EXECUTION_ENABLED,
    anthropicBaseUrlConfigured: Boolean(env.ANTHROPIC_BASE_URL),
    anthropicDefaultModel: env.ANTHROPIC_DEFAULT_MODEL ?? null,
    agnoLocalEnabled: env.AGNO_ENABLED,
    agnoLocalConfigured: Boolean(env.AGNO_BASE_URL),
    agnoLocalExecutionEnabled: env.AGNO_EXECUTION_ENABLED,
  };
}
