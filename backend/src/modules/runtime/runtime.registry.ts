import { agnoHttpRuntimeAdapter } from './runtime.agno-http-adapter';
import { agnoRuntimeAdapter, agnoStubRuntimeAdapter } from './runtime.agno-adapter';
import { getRuntimeConfig } from './runtime.config';
import { localDeterministicRuntimeAdapter } from './runtime.local-adapter';
import type { RuntimeAdapter, RuntimeProvider, RuntimeProviderSummary } from './runtime.types';

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
    return localDeterministicRuntimeAdapter;
  },

  async listProviders(): Promise<RuntimeProviderSummary[]> {
    const current = this.currentProvider();
    const summaries: RuntimeProviderSummary[] = [];
    for (const [provider, adapter] of adapters.entries()) {
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
