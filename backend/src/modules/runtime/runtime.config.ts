import { env } from '../../config/env';
import type { RuntimeFeatureConfig, RuntimeProvider } from './runtime.types';

export function getRuntimeConfig(): RuntimeFeatureConfig {
  const requestTimeoutMs = env.RUNTIME_REQUEST_TIMEOUT_MS ?? env.RUNTIME_DEFAULT_TIMEOUT_MS;
  return {
    provider: env.RUNTIME_PROVIDER as RuntimeProvider,
    adapterEnabled: env.RUNTIME_ADAPTER_ENABLED,
    defaultTimeoutMs: env.RUNTIME_DEFAULT_TIMEOUT_MS,
    requestTimeoutMs,
    requirePrecheck: env.RUNTIME_REQUIRE_PRECHECK,
    allowProviderFallback: env.RUNTIME_ALLOW_PROVIDER_FALLBACK,
    externalToolsAllowed: env.RUNTIME_ALLOW_EXTERNAL_TOOLS,
    agnoEnabled: env.AGNO_ENABLED,
    agnoConfigured: Boolean(env.AGNO_BASE_URL),
    agnoExecutionEnabled: env.AGNO_EXECUTION_ENABLED,
    agnoHealthcheckEnabled: env.AGNO_HEALTHCHECK_ENABLED,
    agnoBaseUrlConfigured: Boolean(env.AGNO_BASE_URL),
    agnoApiKeyConfigured: Boolean(env.AGNO_API_KEY),
    agnoTimeoutMs: env.AGNO_TIMEOUT_MS,
    agnoHealthPath: env.AGNO_HEALTH_PATH,
    agnoCapabilitiesPath: env.AGNO_CAPABILITIES_PATH,
    agnoExecutePath: env.AGNO_EXECUTE_PATH,
    agnoRequireSandbox: env.AGNO_REQUIRE_SANDBOX,
    agnoAllowExternalTools: env.AGNO_ALLOW_EXTERNAL_TOOLS,
    agnoAllowRemoteMcp: env.AGNO_ALLOW_REMOTE_MCP,
    agnoSendRagContext: env.AGNO_SEND_RAG_CONTEXT,
    agnoSendMcpToolDescriptors: env.AGNO_SEND_MCP_TOOL_DESCRIPTORS,
    agnoMaxInputPreviewChars: env.AGNO_MAX_INPUT_PREVIEW_CHARS,
    agnoMaxOutputPreviewChars: env.AGNO_MAX_OUTPUT_PREVIEW_CHARS,
    agnoHttpEnabled: env.AGNO_RUNTIME_HTTP_ENABLED,
    agnoHttpConfigured: Boolean(env.AGNO_RUNTIME_HTTP_BASE_URL),
    agnoHttpBaseUrlConfigured: Boolean(env.AGNO_RUNTIME_HTTP_BASE_URL),
    agnoHttpSecurityKeyConfigured: Boolean(env.AGNO_RUNTIME_HTTP_SECURITY_KEY),
    agnoHttpTimeoutMs: env.AGNO_RUNTIME_HTTP_TIMEOUT_MS,
  };
}
