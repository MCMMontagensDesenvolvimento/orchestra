import { env } from '../../../../config/env';

export interface CorporateReadonlyConfig {
  enabled: boolean;
  allowedOrigin: string;
  timeoutMs: number;
  maxResponseBytes: number;
}

export function getCorporateReadonlyConfig(): CorporateReadonlyConfig {
  return {
    enabled: env.MCP_CORPORATE_READONLY_ENABLED,
    allowedOrigin: env.MCP_CORPORATE_READONLY_ALLOWED_ORIGIN.trim(),
    timeoutMs: env.MCP_CORPORATE_READONLY_TIMEOUT_MS,
    maxResponseBytes: env.MCP_CORPORATE_READONLY_MAX_RESPONSE_BYTES,
  };
}
