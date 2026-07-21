import { getCorporateReadonlyConfig, type CorporateReadonlyConfig } from './corporate-readonly/corporate-readonly.config';
import { CorporateReadonlyHttpTransport } from './corporate-readonly/corporate-readonly.transport';
import { createMcpReadonlyDemoHttpTransport } from './mcp-readonly-demo-http.transport';
import {
  FailClosedMcpRemoteClientTransport,
  type McpRemoteClientTransport,
  type McpRemoteDiscoveryTransport,
  type McpRemoteDiscoveryTransportInput,
  type McpRemoteDiscoveryTransportOutput,
} from './mcp-remote-transport';
import type { McpRemoteClientOptions, McpRemoteFeatureConfig } from './mcp-remote.types';

function parsedUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function matchesDemoOrigin(baseUrl: string | null | undefined, config: McpRemoteFeatureConfig) {
  const target = parsedUrl(baseUrl);
  const demo = parsedUrl(config.localDemoOrigin);
  return Boolean(
    config.allowInsecureLocalDemo
    && target
    && demo
    && target.origin === demo.origin,
  );
}

export function matchesCorporateReadonlyOrigin(
  baseUrl: string | null | undefined,
  config: CorporateReadonlyConfig,
) {
  const target = parsedUrl(baseUrl);
  const allowed = parsedUrl(config.allowedOrigin);
  return Boolean(
    config.enabled
    && target
    && allowed
    && target.protocol === 'https:'
    && allowed.protocol === 'https:'
    && target.origin === allowed.origin
    && target.pathname === '/'
    && allowed.pathname === '/'
    && !target.username
    && !target.password
    && !target.search
    && !target.hash
    && !allowed.username
    && !allowed.password
    && !allowed.search
    && !allowed.hash,
  );
}

export function createGovernedMcpRemoteTransport(
  options: Pick<McpRemoteClientOptions, 'baseUrl'>,
  remoteConfig: McpRemoteFeatureConfig,
  corporateConfig: CorporateReadonlyConfig = getCorporateReadonlyConfig(),
): McpRemoteClientTransport {
  if (matchesDemoOrigin(options.baseUrl, remoteConfig)) {
    return createMcpReadonlyDemoHttpTransport(remoteConfig);
  }
  if (matchesCorporateReadonlyOrigin(options.baseUrl, corporateConfig)) {
    return new CorporateReadonlyHttpTransport({ config: corporateConfig });
  }
  return new FailClosedMcpRemoteClientTransport();
}

export class GovernedMcpRemoteDiscoveryTransport implements McpRemoteDiscoveryTransport {
  constructor(
    private readonly remoteConfig: McpRemoteFeatureConfig,
    private readonly corporateConfig: CorporateReadonlyConfig = getCorporateReadonlyConfig(),
  ) {}

  async discoverTools(input: McpRemoteDiscoveryTransportInput): Promise<McpRemoteDiscoveryTransportOutput> {
    const transport = createGovernedMcpRemoteTransport(input, this.remoteConfig, this.corporateConfig);
    const controller = new AbortController();
    const corporateTarget = matchesCorporateReadonlyOrigin(input.baseUrl, this.corporateConfig);
    const timeoutMs = Math.min(
      input.timeoutMs,
      this.remoteConfig.maxTimeoutMs,
      corporateTarget ? this.corporateConfig.timeoutMs : this.remoteConfig.defaultTimeoutMs,
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await transport.discoverTools({
        serverId: input.serverId,
        baseUrl: input.baseUrl,
        authType: input.authType,
        ...(input.credentialRef ? { credentialRef: input.credentialRef } : {}),
        timeoutMs,
        signal: controller.signal,
        requestId: input.requestId,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
