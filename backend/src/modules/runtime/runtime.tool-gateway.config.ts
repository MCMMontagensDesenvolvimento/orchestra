import { env } from '../../config/env';

export function getRuntimeToolGatewayConfig() {
  return {
    enabled: env.AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED,
    maxPayloadBytes: env.AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES,
    securityKey: env.AGNO_RUNTIME_HTTP_SECURITY_KEY,
    securityRequired: env.AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY,
  };
}
