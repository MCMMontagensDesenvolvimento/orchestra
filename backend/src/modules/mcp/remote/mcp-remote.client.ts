import { AppError } from '../../../shared/errors/app-error';
import { getMcpRemoteConfig } from './mcp-remote.config';
import type {
  GovernedMcpToolExecutionResult,
  GovernedMcpToolExecutionSpec,
  McpRemoteClientErrorCode,
  McpRemoteClientOptions,
  McpRemoteFeatureConfig,
  McpRemoteReadiness,
  McpToolDiscoveryRequest,
  McpToolDiscoveryResult,
} from './mcp-remote.types';

const unsafeOptionKeyFragments = ['authorization', 'credentialvalue', 'cookie', 'password', 'privatekey', 'secret', 'token'];

function assertNoRawCredentialKeys(options: Record<string, unknown>) {
  for (const key of Object.keys(options)) {
    const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
    if (unsafeOptionKeyFragments.some((fragment) => normalized.includes(fragment))) {
      throw new AppError(422, 'MCP_REMOTE_RAW_CREDENTIAL_REJECTED', 'MCP remote client accepts credential status only, not raw credentials.');
    }
  }
}

function clientError(code: McpRemoteClientErrorCode, message: string) {
  return new AppError(409, code, message);
}

function remoteDisabled(config: McpRemoteFeatureConfig) {
  return !config.remoteEnabled;
}

export class McpRemoteClient {
  readonly serverId: string;
  readonly baseUrl: string | null;
  readonly authType: string;
  readonly credentialsConfigured: boolean;
  readonly timeoutMs: number;
  private readonly config: McpRemoteFeatureConfig;

  constructor(options: McpRemoteClientOptions, config: McpRemoteFeatureConfig = getMcpRemoteConfig()) {
    assertNoRawCredentialKeys(options as unknown as Record<string, unknown>);
    this.serverId = options.serverId;
    this.baseUrl = options.baseUrl ?? null;
    this.authType = options.authType ?? 'none';
    this.credentialsConfigured = Boolean(options.credentialsConfigured);
    this.timeoutMs = options.timeoutMs;
    this.config = config;
  }

  async checkHealth(readiness?: McpRemoteReadiness): Promise<McpRemoteReadiness> {
    if (remoteDisabled(this.config)) {
      throw clientError('MCP_REMOTE_DISABLED', 'MCP remote health is disabled by backend configuration.');
    }
    if (readiness && readiness.status !== 'ready') {
      throw clientError('MCP_REMOTE_NOT_IMPLEMENTED', readiness.reason);
    }
    throw clientError('MCP_REMOTE_NOT_IMPLEMENTED', 'MCP remote health transport is not implemented in this phase.');
  }

  async discoverTools(request: McpToolDiscoveryRequest): Promise<McpToolDiscoveryResult> {
    void request;
    if (remoteDisabled(this.config)) {
      throw clientError('MCP_REMOTE_DISABLED', 'MCP remote discovery is disabled because MCP remote is disabled.');
    }
    if (!this.config.discoveryEnabled) {
      throw clientError('MCP_REMOTE_DISCOVERY_DISABLED', 'MCP remote discovery is disabled by backend configuration.');
    }
    throw clientError('MCP_REMOTE_NOT_IMPLEMENTED', 'MCP remote discovery transport is not implemented in this phase.');
  }

  async executeTool(spec: GovernedMcpToolExecutionSpec): Promise<GovernedMcpToolExecutionResult> {
    void spec;
    if (remoteDisabled(this.config)) {
      throw clientError('MCP_REMOTE_DISABLED', 'MCP remote execution is disabled because MCP remote is disabled.');
    }
    if (!this.config.executionEnabled) {
      throw clientError('MCP_REMOTE_EXECUTION_DISABLED', 'MCP remote execution is disabled by backend configuration.');
    }
    throw clientError('MCP_REMOTE_NOT_IMPLEMENTED', 'MCP remote tool execution transport is not implemented in this phase.');
  }
}
