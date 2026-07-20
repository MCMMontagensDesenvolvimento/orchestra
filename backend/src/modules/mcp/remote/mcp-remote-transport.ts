import { AppError } from '../../../shared/errors/app-error';
import type { McpToolDiscoveryResult } from './mcp-remote.types';

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

export interface McpRemoteClientTransportContext {
  serverId: string;
  baseUrl: string;
  authType: string;
  credentialRef?: string;
  timeoutMs: number;
  signal: AbortSignal;
}

export interface McpRemoteReadonlyTransportInput extends McpRemoteClientTransportContext {
  executionId: string;
  toolName: string;
  input: unknown;
}

export interface McpRemoteReadonlyTransportOutput {
  content: string;
  responseBytes: number;
  simulated: boolean;
}

export interface McpRemoteClientTransport {
  checkHealth(input: McpRemoteClientTransportContext): Promise<{ status: 'healthy'; simulated: boolean }>;
  discoverTools(input: McpRemoteClientTransportContext & { requestId: string }): Promise<McpToolDiscoveryResult>;
  executeReadonlyTool(input: McpRemoteReadonlyTransportInput): Promise<McpRemoteReadonlyTransportOutput>;
}

export class FailClosedMcpRemoteClientTransport implements McpRemoteClientTransport {
  private unavailable(): never {
    throw new AppError(409, 'MCP_REMOTE_NOT_IMPLEMENTED', 'MCP remote transport is not configured.');
  }

  async checkHealth(): Promise<{ status: 'healthy'; simulated: boolean }> {
    return this.unavailable();
  }

  async discoverTools(): Promise<McpToolDiscoveryResult> {
    return this.unavailable();
  }

  async executeReadonlyTool(): Promise<McpRemoteReadonlyTransportOutput> {
    return this.unavailable();
  }
}
