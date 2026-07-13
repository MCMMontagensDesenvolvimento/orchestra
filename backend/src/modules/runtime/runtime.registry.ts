import { agnoHttpRuntimeAdapter } from './runtime.agno-http-adapter';
import { agnoRuntimeAdapter, agnoStubRuntimeAdapter } from './runtime.agno-adapter';
import { getRuntimeConfig } from './runtime.config';
import { localDeterministicRuntimeAdapter } from './runtime.local-adapter';
import type {
  RuntimeAdapter,
  RuntimeFeatureConfig,
  RuntimeProvider,
  RuntimeProviderSummary,
} from './runtime.types';

const adapters = new Map<RuntimeProvider, RuntimeAdapter>([
  ['local', localDeterministicRuntimeAdapter],
  ['agno_stub', agnoStubRuntimeAdapter],
  ['agno', agnoRuntimeAdapter],
  ['agno_http', agnoHttpRuntimeAdapter],
]);

export const runtimeAdapterRegistry = {
  currentProvider(): RuntimeProvider {
    return getRuntimeConfig().provider;
  },

  get(provider?: RuntimeProvider): RuntimeAdapter {
    const selectedProvider = provider ?? getRuntimeConfig().provider;
    const adapter = adapters.get(selectedProvider);
    if (adapter) return adapter;
    if (getRuntimeConfig().allowProviderFallback) return localDeterministicRuntimeAdapter;
    throw new Error('Selected runtime provider is not registered; automatic fallback is disabled.');
  },

  async listProviders(): Promise<RuntimeProviderSummary[]> {
    const config = getRuntimeConfig();
    const current = config.provider;
    const summaries: RuntimeProviderSummary[] = [];
    for (const [provider, adapter] of adapters.entries()) {
      const [health, capabilities] = await Promise.all([
        adapter.healthCheck(),
        adapter.getCapabilities(),
      ]);
      summaries.push({
        provider,
        current: provider === current,
        ...providerState(provider, config),
        health,
        capabilities,
      });
    }
    return summaries;
  },
};

function providerState(provider: RuntimeProvider, config: RuntimeFeatureConfig) {
  if (provider === 'local') {
    return { enabled: config.adapterEnabled, configured: true };
  }
  if (provider === 'agno_stub') {
    return { enabled: false, configured: config.agnoConfigured };
  }
  if (provider === 'agno') {
    return {
      enabled: config.adapterEnabled && config.agnoEnabled,
      configured: config.agnoConfigured,
    };
  }
  return {
    enabled: config.adapterEnabled && config.agnoHttpEnabled,
    configured: config.agnoHttpConfigured,
  };
}
