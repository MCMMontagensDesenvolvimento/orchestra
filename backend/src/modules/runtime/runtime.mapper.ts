import type { RuntimeCapabilities, RuntimeFeatureConfig, RuntimeHealth, RuntimeProviderSummary } from './runtime.types';

export function mapRuntimeConfig(config: RuntimeFeatureConfig) {
  return {
    provider: config.provider,
    adapterEnabled: config.adapterEnabled,
    defaultTimeoutMs: config.defaultTimeoutMs,
    requestTimeoutMs: config.requestTimeoutMs,
    requirePrecheck: config.requirePrecheck,
    allowProviderFallback: config.allowProviderFallback,
    externalToolsAllowed: config.externalToolsAllowed,
    agnoEnabled: config.agnoEnabled,
    agnoConfigured: config.agnoConfigured,
    agnoExecutionEnabled: config.agnoExecutionEnabled,
    agnoHealthcheckEnabled: config.agnoHealthcheckEnabled,
    agnoBaseUrlConfigured: config.agnoBaseUrlConfigured,
    agnoApiKeyConfigured: config.agnoApiKeyConfigured,
    agnoRequireSandbox: config.agnoRequireSandbox,
    agnoAllowExternalTools: config.agnoAllowExternalTools,
    agnoAllowRemoteMcp: config.agnoAllowRemoteMcp,
    agnoSendRagContext: config.agnoSendRagContext,
    agnoSendMcpToolDescriptors: config.agnoSendMcpToolDescriptors,
    agnoMaxInputPreviewChars: config.agnoMaxInputPreviewChars,
    agnoMaxOutputPreviewChars: config.agnoMaxOutputPreviewChars,
    agnoHttpEnabled: config.agnoHttpEnabled,
    agnoHttpConfigured: config.agnoHttpConfigured,
    agnoHttpBaseUrlConfigured: config.agnoHttpBaseUrlConfigured,
    agnoHttpSecurityKeyConfigured: config.agnoHttpSecurityKeyConfigured,
    agnoHttpTimeoutMs: config.agnoHttpTimeoutMs,
  };
}

export function mapRuntimeHealth(health: RuntimeHealth) {
  return health;
}

export function mapRuntimeCapabilities(capabilities: RuntimeCapabilities) {
  return capabilities;
}

export function mapRuntimeProvider(provider: RuntimeProviderSummary) {
  return provider;
}
