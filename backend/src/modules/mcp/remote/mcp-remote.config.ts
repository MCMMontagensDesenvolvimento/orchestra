import { env } from '../../../config/env';
import type { McpRemoteFeatureConfig } from './mcp-remote.types';

export function getMcpRemoteConfig(): McpRemoteFeatureConfig {
  return {
    remoteEnabled: env.MCP_REMOTE_ENABLED,
    discoveryEnabled: env.MCP_REMOTE_DISCOVERY_ENABLED,
    executionEnabled: env.MCP_REMOTE_EXECUTION_ENABLED,
    readOnlyEnabled: env.MCP_REMOTE_READONLY_ENABLED,
    egressAllowlist: env.MCP_REMOTE_EGRESS_ALLOWLIST,
    defaultTimeoutMs: env.MCP_REMOTE_DEFAULT_TIMEOUT_MS,
    maxTimeoutMs: env.MCP_REMOTE_MAX_TIMEOUT_MS,
    maxResponseBytes: env.MCP_REMOTE_MAX_RESPONSE_BYTES,
    requireSecretRef: env.MCP_REMOTE_REQUIRE_SECRET_REF,
    allowWriteTools: env.MCP_REMOTE_ALLOW_WRITE_TOOLS,
    environment: env.NODE_ENV,
    allowInsecureLocalDemo: env.MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO,
    localDemoOrigin: env.MCP_REMOTE_LOCAL_DEMO_ORIGIN,
  };
}
