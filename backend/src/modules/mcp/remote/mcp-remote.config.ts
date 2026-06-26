import { env } from '../../../config/env';
import type { McpRemoteFeatureConfig } from './mcp-remote.types';

export function getMcpRemoteConfig(): McpRemoteFeatureConfig {
  return {
    remoteEnabled: env.MCP_REMOTE_ENABLED,
    discoveryEnabled: env.MCP_REMOTE_DISCOVERY_ENABLED,
    executionEnabled: env.MCP_REMOTE_EXECUTION_ENABLED,
    defaultTimeoutMs: env.MCP_REMOTE_DEFAULT_TIMEOUT_MS,
  };
}
