import type { RuntimeCapabilities, RuntimeFeatureConfig, RuntimeHealth, RuntimeProviderSummary } from './runtime.types';

export function mapRuntimeConfig(config: RuntimeFeatureConfig) {
  return {
    provider: config.provider,
    adapterEnabled: config.adapterEnabled,
    requestTimeoutMs: config.requestTimeoutMs,
    requirePrecheck: config.requirePrecheck,
    externalToolsAllowed: config.externalToolsAllowed,
    agnoEnabled: config.agnoEnabled,
    agnoConfigured: config.agnoConfigured,
    agnoHealthcheckEnabled: config.agnoHealthcheckEnabled,
    agnoBaseUrlConfigured: config.agnoBaseUrlConfigured,
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
