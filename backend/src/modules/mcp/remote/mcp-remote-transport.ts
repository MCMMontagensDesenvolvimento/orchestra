import { AppError } from '../../../shared/errors/app-error';

export interface McpRemoteDiscoveryTransportInput {
  serverId: string;
  baseUrl: string;
  authType: string;
  credentialsConfigured: boolean;
  timeoutMs: number;
  requestId: string;
}

export interface McpRemoteDiscoveryTransportTool {
  externalName: string;
  displayName?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface McpRemoteDiscoveryTransportOutput {
  protocolVersion?: string;
  tools: McpRemoteDiscoveryTransportTool[];
  warnings?: Array<{ code: string; message: string }>;
}

export interface McpRemoteDiscoveryTransport {
  discoverTools(input: McpRemoteDiscoveryTransportInput): Promise<McpRemoteDiscoveryTransportOutput>;
}

export class FailClosedMcpRemoteDiscoveryTransport implements McpRemoteDiscoveryTransport {
  async discoverTools(input: McpRemoteDiscoveryTransportInput): Promise<McpRemoteDiscoveryTransportOutput> {
    void input;
    throw new AppError(409, 'MCP_REMOTE_NOT_IMPLEMENTED', 'MCP remote discovery transport is not configured.');
  }
}
