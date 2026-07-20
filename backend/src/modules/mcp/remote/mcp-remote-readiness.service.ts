import { getMcpRemoteConfig } from './mcp-remote.config';
import type {
  GovernedMcpRemotePolicy,
  GovernedMcpRemoteServer,
  McpRemoteFeatureConfig,
  McpRemoteReadiness,
  McpRemoteReadinessCheck,
  McpRemoteReadinessCheckName,
  McpRemoteReadinessInput,
  McpRemoteReadinessStatus,
} from './mcp-remote.types';

const credentialAuthTypes = new Set(['api_key', 'bearer', 'oauth', 'mTLS', 'other']);

function check(name: McpRemoteReadinessCheckName, status: McpRemoteReadinessCheck['status'], message?: string): McpRemoteReadinessCheck {
  return message ? { name, status, message } : { name, status };
}

function featureConfig(input?: McpRemoteFeatureConfig): McpRemoteFeatureConfig {
  return input ?? getMcpRemoteConfig();
}

function isArchivedOrDisabled(server: GovernedMcpRemoteServer) {
  return Boolean(server.deletedAt) || server.status === 'archived' || server.status === 'disabled';
}

function requiresCredential(authType?: string | null) {
  return credentialAuthTypes.has(authType ?? 'none');
}

function baseUrlRequired(input: McpRemoteReadinessInput) {
  return input.requiresBaseUrl ?? true;
}

function policyAllowsRemoteExecution(policy: GovernedMcpRemotePolicy | null | undefined) {
  return Boolean(policy?.allowRuntimeExecution) && policy?.blockedByDefault === false && policy?.sandboxOnly === false;
}

function policyAllowsControlledDiscovery(policy: GovernedMcpRemotePolicy | null | undefined) {
  return policy?.allowDiscovery !== false;
}

function disabledReadiness(config: McpRemoteFeatureConfig): McpRemoteReadiness {
  return {
    status: 'disabled',
    failClosed: true,
    remoteEnabled: false,
    discoveryEnabled: config.discoveryEnabled,
    executionEnabled: config.executionEnabled,
    reason: 'MCP remote is disabled by backend configuration.',
    checks: [
      check('feature_flag', 'fail', 'MCP_REMOTE_ENABLED=false.'),
      check('server_status', 'skipped'),
      check('transport', 'skipped'),
      check('auth', 'skipped'),
      check('policy', 'skipped'),
      check('discovery', 'skipped'),
      check('execution', 'skipped'),
    ],
    credentialsConfigured: false,
    timeoutMs: config.defaultTimeoutMs,
  };
}

function result(input: {
  status: McpRemoteReadinessStatus;
  config: McpRemoteFeatureConfig;
  server?: GovernedMcpRemoteServer | null;
  reason: string;
  checks: McpRemoteReadinessCheck[];
  credentialsConfigured: boolean;
  authType?: string;
}): McpRemoteReadiness {
  return {
    status: input.status,
    failClosed: input.status !== 'ready',
    remoteEnabled: input.config.remoteEnabled,
    discoveryEnabled: input.config.discoveryEnabled,
    executionEnabled: input.config.executionEnabled,
    serverId: input.server?.id,
    reason: input.reason,
    checks: input.checks,
    credentialsConfigured: input.credentialsConfigured,
    authType: input.authType,
    timeoutMs: input.config.defaultTimeoutMs,
  };
}

export class McpRemoteReadinessService {
  getReadiness(input: McpRemoteReadinessInput = {}): McpRemoteReadiness {
    const config = featureConfig(input.config);
    if (!config.remoteEnabled) return disabledReadiness(config);

    const server = input.server ?? null;
    const authType = server?.authType ?? 'none';
    const credentialsConfigured = Boolean(input.credentialsConfigured || server?.secretRef);
    const purpose = input.purpose ?? 'execution';
    const checks: McpRemoteReadinessCheck[] = [check('feature_flag', 'pass')];

    if (!server) {
      checks.push(
        check('server_status', 'fail', 'MCP remote server was not provided.'),
        check('transport', 'skipped'),
        check('auth', 'skipped'),
        check('policy', 'skipped'),
        check('discovery', 'skipped'),
        check('execution', 'skipped'),
      );
      return result({
        status: 'misconfigured',
        config,
        server,
        reason: 'MCP remote server is missing.',
        checks,
        credentialsConfigured,
        authType,
      });
    }

    if (isArchivedOrDisabled(server) || server.status !== 'active') {
      checks.push(
        check('server_status', 'fail', `MCP server status "${server.status}" blocks remote readiness.`),
        check('transport', 'skipped'),
        check('auth', 'skipped'),
        check('policy', 'skipped'),
        check('discovery', 'skipped'),
        check('execution', 'skipped'),
      );
      return result({
        status: 'blocked',
        config,
        server,
        reason: 'MCP server is not active for remote readiness.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('server_status', 'pass'));

    if (baseUrlRequired(input) && !server.baseUrl) {
      checks.push(
        check('transport', 'fail', 'MCP remote server requires a baseUrl.'),
        check('auth', 'skipped'),
        check('policy', 'skipped'),
        check('discovery', 'skipped'),
        check('execution', 'skipped'),
      );
      return result({
        status: 'misconfigured',
        config,
        server,
        reason: 'MCP remote server is missing baseUrl.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('transport', 'pass'));

    if (
      requiresCredential(authType)
      && (!credentialsConfigured || (config.requireSecretRef && !server.secretRef?.trim()))
    ) {
      checks.push(
        check('auth', 'fail', `MCP auth type "${authType}" requires backend credentials.`),
        check('policy', 'skipped'),
        check('discovery', 'skipped'),
        check('execution', 'skipped'),
      );
      return result({
        status: 'auth_required',
        config,
        server,
        reason: 'MCP remote credentials are not configured.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('auth', 'pass'));

    if (purpose === 'discovery') {
      if (!config.discoveryEnabled) {
        checks.push(
          check('discovery', 'fail', 'MCP_REMOTE_DISCOVERY_ENABLED=false.'),
          check('execution', config.executionEnabled ? 'pass' : 'skipped'),
          check('policy', 'skipped'),
        );
        return result({
          status: 'discovery_disabled',
          config,
          server,
          reason: 'MCP remote discovery is disabled by backend configuration.',
          checks,
          credentialsConfigured,
          authType,
        });
      }
      checks.push(check('discovery', 'pass'));

      checks.push(config.executionEnabled
        ? check('execution', 'pass')
        : check('execution', 'skipped', 'MCP_REMOTE_EXECUTION_ENABLED=false; discovery can continue while runtime execution remains blocked.'));

      if (!policyAllowsControlledDiscovery(input.policy)) {
        checks.push(check('policy', 'fail', 'MCP policy blocks controlled discovery.'));
        return result({
          status: 'blocked',
          config,
          server,
          reason: 'MCP remote discovery is blocked by policy.',
          checks,
          credentialsConfigured,
          authType,
        });
      }
      checks.push(check('policy', 'pass', 'MCP policy allows controlled discovery; runtime execution remains separately governed.'));

      return result({
        status: 'ready',
        config,
        server,
        reason: 'MCP remote discovery readiness is structurally ready, with runtime execution still governed separately.',
        checks,
        credentialsConfigured,
        authType,
      });
    }

    if (!config.executionEnabled) {
      checks.push(
        check('execution', 'fail', 'MCP_REMOTE_EXECUTION_ENABLED=false.'),
        check('discovery', config.discoveryEnabled ? 'pass' : 'skipped'),
        check('policy', 'skipped'),
      );
      return result({
        status: 'execution_disabled',
        config,
        server,
        reason: 'MCP remote execution is disabled by backend configuration.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('execution', 'pass'));

    if (!config.readOnlyEnabled) {
      checks.push(check('readonly', 'fail', 'MCP_REMOTE_READONLY_ENABLED=false.'));
      return result({
        status: 'readonly_disabled',
        config,
        server,
        reason: 'MCP remote read-only execution is disabled by backend configuration.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('readonly', 'pass'));

    if (!config.discoveryEnabled) {
      checks.push(
        check('discovery', 'fail', 'MCP_REMOTE_DISCOVERY_ENABLED=false.'),
        check('policy', 'skipped'),
      );
      return result({
        status: 'discovery_disabled',
        config,
        server,
        reason: 'MCP remote discovery is disabled by backend configuration.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('discovery', 'pass'));

    if (!policyAllowsRemoteExecution(input.policy)) {
      checks.push(check('policy', 'fail', 'MCP policy keeps remote runtime execution blocked by default.'));
      return result({
        status: 'execution_disabled',
        config,
        server,
        reason: 'MCP remote execution is blocked by policy.',
        checks,
        credentialsConfigured,
        authType,
      });
    }
    checks.push(check('policy', 'pass'));

    return result({
      status: 'ready',
      config,
      server,
      reason: 'MCP remote readiness is structurally ready, with no remote call performed.',
      checks,
      credentialsConfigured,
      authType,
    });
  }
}

export const mcpRemoteReadinessService = new McpRemoteReadinessService();
