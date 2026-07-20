import { AppError } from '../../../shared/errors/app-error';
import type {
  McpRemoteClientTransport,
  McpRemoteClientTransportContext,
  McpRemoteDiscoveryTransport,
  McpRemoteDiscoveryTransportInput,
  McpRemoteReadonlyTransportInput,
  McpRemoteReadonlyTransportOutput,
} from './mcp-remote-transport';
import type { McpRemoteFeatureConfig, McpToolDiscoveryResult } from './mcp-remote.types';

const allowedToolNames = new Set(['catalog.search', 'catalog.get_status']);
const sensitiveKeyPattern = /authorization|cookie|credential|password|private.?key|secret|token|api.?key/i;

type FetchImplementation = typeof fetch;

interface DemoTransportOptions {
  allowedOrigin?: string;
  maxResponseBytes: number;
  maxRequestBytes?: number;
  fetchImplementation?: FetchImplementation;
}

function transportError(message = 'MCP read-only demo transport failed.') {
  return new AppError(409, 'MCP_REMOTE_TRANSPORT_FAILED', message);
}

function responseTooLarge() {
  return new AppError(409, 'MCP_REMOTE_RESPONSE_TOO_LARGE', 'MCP remote response exceeded the governed limit.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasSensitiveKeys(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => hasSensitiveKeys(item, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => (
    sensitiveKeyPattern.test(key) || hasSensitiveKeys(item, depth + 1)
  ));
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<{ value: unknown; bytes: number }> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) throw transportError();
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw responseTooLarge();
  if (!response.body) throw transportError();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw responseTooLarge();
    }
    chunks.push(value);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'));
  } catch {
    throw transportError();
  }
  if (hasSensitiveKeys(parsed)) throw transportError();
  return { value: parsed, bytes };
}

function exactOrigin(value: string | undefined) {
  if (!value) throw new AppError(409, 'MCP_REMOTE_NOT_IMPLEMENTED', 'MCP read-only demo origin is not configured.');
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw transportError();
    return parsed.origin;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw transportError();
  }
}

function controlledEndpoint(baseUrl: string, allowedOrigin: string, pathname: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw transportError();
  }
  if (parsed.origin !== allowedOrigin || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new AppError(409, 'MCP_REMOTE_EGRESS_BLOCKED', 'MCP remote destination is outside the controlled demo origin.');
  }
  return new URL(pathname, `${allowedOrigin}/`).toString();
}

function catalogTool(value: unknown) {
  if (!isRecord(value)) throw transportError();
  const externalName = safeText(value.externalName, 128);
  const displayName = safeText(value.displayName, 160);
  const description = safeText(value.description, 1_000);
  if (
    !externalName
    || !allowedToolNames.has(externalName)
    || !displayName
    || value.readOnly !== true
    || value.riskLevel !== 'low'
    || !isRecord(value.inputSchema)
    || !isRecord(value.outputSchema)
  ) throw transportError('MCP read-only demo catalog failed governance validation.');
  return {
    externalName,
    displayName,
    ...(description ? { description } : {}),
    inputSchema: value.inputSchema,
    outputSchema: value.outputSchema,
    inferredRiskLevel: 'low' as const,
    requiresApproval: false,
    defaultPolicy: {
      allowRuntimeExecution: false as const,
      sandboxOnly: true as const,
      blockedByDefault: true as const,
    },
  };
}

export class McpReadonlyDemoHttpTransport implements McpRemoteClientTransport, McpRemoteDiscoveryTransport {
  private readonly allowedOrigin: string;
  private readonly maxResponseBytes: number;
  private readonly maxRequestBytes: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: DemoTransportOptions) {
    this.allowedOrigin = exactOrigin(options.allowedOrigin);
    this.maxResponseBytes = options.maxResponseBytes;
    this.maxRequestBytes = options.maxRequestBytes ?? 8_192;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  private async getJson(baseUrl: string, pathname: string, signal: AbortSignal) {
    const response = await this.fetchImplementation(controlledEndpoint(baseUrl, this.allowedOrigin, pathname), {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'manual',
      signal,
    });
    if (!response.ok) throw transportError();
    return readBoundedJson(response, this.maxResponseBytes);
  }

  async checkHealth(input: McpRemoteClientTransportContext): Promise<{ status: 'healthy'; simulated: boolean }> {
    const { value } = await this.getJson(input.baseUrl, '/health', input.signal);
    if (!isRecord(value) || value.status !== 'healthy' || value.service !== 'mcp-readonly-demo') throw transportError();
    return { status: 'healthy', simulated: false };
  }

  async discoverTools(
    input: (McpRemoteClientTransportContext & { requestId: string }) | McpRemoteDiscoveryTransportInput,
  ): Promise<McpToolDiscoveryResult> {
    const controller = 'signal' in input ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : undefined;
    try {
      const { value } = await this.getJson(
        input.baseUrl,
        '/v1/catalog',
        'signal' in input ? input.signal : controller!.signal,
      );
      if (
        !isRecord(value)
        || value.status !== 'ready'
        || !isRecord(value.server)
        || value.server.readOnly !== true
        || value.server.dataClassification !== 'fictitious'
        || !Array.isArray(value.tools)
        || value.tools.length !== allowedToolNames.size
      ) throw transportError('MCP read-only demo catalog failed governance validation.');
      const tools = value.tools.map(catalogTool);
      if (new Set(tools.map((tool) => tool.externalName)).size !== allowedToolNames.size) throw transportError();
      return {
        serverId: input.serverId,
        status: 'completed',
        protocolVersion: safeText(value.protocolVersion, 64),
        discoveredAt: new Date().toISOString(),
        tools,
        diff: { added: tools.map((tool) => tool.externalName).sort(), changed: [], removed: [] },
        warnings: [],
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async executeReadonlyTool(input: McpRemoteReadonlyTransportInput): Promise<McpRemoteReadonlyTransportOutput> {
    if (!allowedToolNames.has(input.toolName)) {
      throw new AppError(409, 'MCP_REMOTE_TOOL_OPERATION_BLOCKED', 'MCP demo tool is not in the read-only allowlist.');
    }
    const body = JSON.stringify({ executionId: input.executionId, toolName: input.toolName, input: input.input });
    if (Buffer.byteLength(body, 'utf8') > this.maxRequestBytes) {
      throw new AppError(409, 'MCP_REMOTE_POLICY_BLOCKED', 'MCP remote input exceeded the governed limit.');
    }
    const response = await this.fetchImplementation(
      controlledEndpoint(input.baseUrl, this.allowedOrigin, '/v1/tools/call'),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-request-id': input.executionId,
        },
        body,
        redirect: 'manual',
        signal: input.signal,
      },
    );
    if (!response.ok) throw transportError();
    const { value, bytes } = await readBoundedJson(response, this.maxResponseBytes);
    if (
      !isRecord(value)
      || value.status !== 'completed'
      || value.simulated !== false
      || !safeText(value.content, 1_000)
    ) throw transportError();
    return { content: String(value.content), responseBytes: bytes, simulated: false };
  }
}

export function createMcpReadonlyDemoHttpTransport(config: McpRemoteFeatureConfig) {
  return new McpReadonlyDemoHttpTransport({
    allowedOrigin: config.localDemoOrigin,
    maxResponseBytes: config.maxResponseBytes,
  });
}
