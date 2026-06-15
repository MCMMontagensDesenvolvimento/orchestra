import { env } from '../../config/env';
import type { RuntimeFeatureConfig, RuntimeProvider } from './runtime.types';

export function getRuntimeConfig(): RuntimeFeatureConfig {
  return {
    provider: env.RUNTIME_PROVIDER as RuntimeProvider,
    adapterEnabled: env.RUNTIME_ADAPTER_ENABLED,
    requestTimeoutMs: env.RUNTIME_REQUEST_TIMEOUT_MS,
    requirePrecheck: env.RUNTIME_REQUIRE_PRECHECK,
    externalToolsAllowed: env.RUNTIME_ALLOW_EXTERNAL_TOOLS,
    agnoEnabled: env.AGNO_ENABLED,
    agnoConfigured: Boolean(env.AGNO_BASE_URL && env.AGNO_API_KEY),
    agnoHealthcheckEnabled: env.AGNO_HEALTHCHECK_ENABLED,
    agnoBaseUrlConfigured: Boolean(env.AGNO_BASE_URL),
  };
}
