import { AppError } from '../../../../shared/errors/app-error';
import type {
  McpRemoteClientTransport,
  McpRemoteClientTransportContext,
  McpRemoteReadonlyTransportInput,
  McpRemoteReadonlyTransportOutput,
} from '../mcp-remote-transport';
import type { McpToolDiscoveryResult } from '../mcp-remote.types';
import type { CorporateReadonlyConfig } from './corporate-readonly.config';

export const corporateReadonlyToolName = 'corporate.status.read';
export const corporateReadonlyInputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string', enum: ['summary', 'availability'] },
  },
} as const;
export const corporateReadonlyOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'summary', 'updatedAt'],
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    summary: { type: 'string', maxLength: 240 },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const allowedScopes = new Set(['summary', 'availability']);
const allowedStatuses = new Set(['ok', 'degraded']);
const legacyHealthKeys = new Set(['status', 'service', 'timestamp', 'requestId']);
const statusEndpointKeys = new Set(['status', 'summary', 'updatedAt']);
const unsafeResponseKey = /authorization|cookie|credential|password|private.?key|secret|token|api.?key|connection|string|prompt|context|argument|args|output|header|raw|body/i;
const sensitiveText = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|(?:password|token|api[_-]?key|secret|credential)\s*[:=]\s*\S+)/i;
const unsafeMarkup = /[<>]/;
const defaultMaxRequestBytes = 512;

type FetchImplementation = typeof fetch;
type CorporateReadonlyPath = '/health' | '/v1/status' | '/v1/status/availability';
export type CorporateReadonlyCredentialResolver = (secretRef: string) => Promise<string>;

export interface CorporateReadonlyTransportOptions {
  config: CorporateReadonlyConfig;
  fetchImplementation?: FetchImplementation;
  resolveCredential?: CorporateReadonlyCredentialResolver;
  maxRequestBytes?: number;
}

function transportError(message = 'Corporate read-only transport failed.') {
  return new AppError(409, 'MCP_REMOTE_TRANSPORT_FAILED', message);
}

function egressBlocked(message = 'Corporate read-only destination was blocked.') {
  return new AppError(409, 'MCP_REMOTE_EGRESS_BLOCKED', message);
}

function responseTooLarge() {
  return new AppError(409, 'MCP_REMOTE_RESPONSE_TOO_LARGE', 'Corporate read-only response exceeded the governed limit.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnsafeResponse(value: unknown, depth = 0): boolean {
  if (depth > 6) return true;
  if (typeof value === 'string') return sensitiveText.test(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return false;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeResponse(item, depth + 1));
  if (!isRecord(value)) return true;
  return Object.entries(value).some(([key, item]) => unsafeResponseKey.test(key) || hasUnsafeResponse(item, depth + 1));
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (
    !normalized
    || normalized.length > maxLength
    || sensitiveText.test(normalized)
    || unsafeMarkup.test(normalized)
  ) return undefined;
  return normalized;
}

function hasExactKeys(value: Record<string, unknown>, expected: Set<string>) {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function safeIsoTimestamp(value: unknown) {
  const timestamp = safeText(value, 40);
  if (
    !timestamp
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)
  ) return undefined;
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function exactHttpsOrigin(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw egressBlocked();
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) throw egressBlocked();
  return parsed.origin;
}

function controlledEndpoint(baseUrl: string, allowedOrigin: string, pathname: string) {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw egressBlocked();
  }
  if (
    parsed.origin !== allowedOrigin
    || parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) throw egressBlocked();
  return new URL(pathname, `${allowedOrigin}/`).toString();
}

async function defaultCredentialResolver(secretRef: string) {
  const match = /^env:\/\/(ORCHESTRA_CORPORATE_READONLY_[A-Z0-9_]+)$/.exec(secretRef);
  if (!match) {
    throw new AppError(409, 'MCP_REMOTE_SECRET_REF_REQUIRED', 'Corporate read-only requires an approved logical secret reference.');
  }
  const value = process.env[match[1]];
  if (!value || value.length < 12 || value.length > 4096 || !/^[\x21-\x7e]+$/.test(value)) {
    throw new AppError(409, 'MCP_REMOTE_SECRET_REF_REQUIRED', 'Corporate read-only credential is not available through the approved reference.');
  }
  return value;
}

async function readBoundedJson(response: Response, maxBytes: number) {
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
  if (hasUnsafeResponse(parsed)) throw transportError();
  return { value: parsed, bytes };
}

function normalizedScope(value: unknown, maxRequestBytes: number) {
  if (!isRecord(value)) throw new AppError(409, 'MCP_REMOTE_POLICY_BLOCKED', 'Corporate read-only input is invalid.');
  if (Object.keys(value).some((key) => key !== 'scope')) {
    throw new AppError(409, 'MCP_REMOTE_POLICY_BLOCKED', 'Corporate read-only input contains unsupported fields.');
  }
  const scope = value.scope ?? 'summary';
  if (typeof scope !== 'string' || !allowedScopes.has(scope)) {
    throw new AppError(409, 'MCP_REMOTE_POLICY_BLOCKED', 'Corporate read-only scope is invalid.');
  }
  if (Buffer.byteLength(JSON.stringify({ scope }), 'utf8') > maxRequestBytes) {
    throw new AppError(409, 'MCP_REMOTE_POLICY_BLOCKED', 'Corporate read-only input exceeded the governed limit.');
  }
  return scope;
}

function sanitizedStatus(value: unknown, pathname: CorporateReadonlyPath) {
  if (!isRecord(value) || typeof value.status !== 'string' || !allowedStatuses.has(value.status)) {
    throw transportError();
  }

  if (pathname === '/health') {
    if (
      !hasExactKeys(value, legacyHealthKeys)
      || value.service !== 'orchestra-backend'
      || !safeText(value.requestId, 120)
    ) throw transportError();
    const updatedAt = safeIsoTimestamp(value.timestamp);
    if (!updatedAt) throw transportError();
    return {
      status: value.status,
      summary: 'Orchestra health endpoint operational',
      updatedAt,
    };
  }

  if (!hasExactKeys(value, statusEndpointKeys)) throw transportError();
  const summary = safeText(value.summary, 240);
  const updatedAt = safeIsoTimestamp(value.updatedAt);
  if (!summary || !updatedAt) throw transportError();
  return {
    status: value.status,
    summary,
    updatedAt,
  };
}

export class CorporateReadonlyHttpTransport implements McpRemoteClientTransport {
  private readonly config: CorporateReadonlyConfig;
  private readonly allowedOrigin: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly resolveCredential: CorporateReadonlyCredentialResolver;
  private readonly maxRequestBytes: number;

  constructor(options: CorporateReadonlyTransportOptions) {
    this.config = options.config;
    this.allowedOrigin = options.config.allowedOrigin ? exactHttpsOrigin(options.config.allowedOrigin) : '';
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.resolveCredential = options.resolveCredential ?? defaultCredentialResolver;
    this.maxRequestBytes = options.maxRequestBytes ?? defaultMaxRequestBytes;
  }

  private assertConfigured(input: McpRemoteClientTransportContext) {
    if (!this.config.enabled) throw new AppError(409, 'MCP_REMOTE_DISABLED', 'Corporate read-only transport is disabled.');
    if (!this.allowedOrigin) throw egressBlocked();
    if (input.authType !== 'bearer' || !input.credentialRef) {
      throw new AppError(409, 'MCP_REMOTE_SECRET_REF_REQUIRED', 'Corporate read-only requires bearer auth through a logical secret reference.');
    }
  }

  private async getJson(input: McpRemoteClientTransportContext, pathname: string) {
    this.assertConfigured(input);
    const credential = await this.resolveCredential(input.credentialRef!);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    input.signal.addEventListener('abort', forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImplementation(controlledEndpoint(input.baseUrl, this.allowedOrigin, pathname), {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${credential}`,
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) throw egressBlocked('Corporate read-only redirect was blocked.');
      if (!response.ok) throw transportError();
      return await readBoundedJson(response, this.config.maxResponseBytes);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw transportError();
    } finally {
      clearTimeout(timer);
      input.signal.removeEventListener('abort', forwardAbort);
    }
  }

  async checkHealth(input: McpRemoteClientTransportContext): Promise<{ status: 'healthy'; simulated: boolean }> {
    const { value } = await this.getJson(input, '/health');
    sanitizedStatus(value, '/health');
    return { status: 'healthy', simulated: false };
  }

  async discoverTools(input: McpRemoteClientTransportContext & { requestId: string }): Promise<McpToolDiscoveryResult> {
    await this.checkHealth(input);
    return {
      serverId: input.serverId,
      status: 'completed',
      protocolVersion: 'orchestra-corporate-readonly/1.0',
      discoveredAt: new Date().toISOString(),
      tools: [{
        externalName: corporateReadonlyToolName,
        displayName: 'Corporate Status Read',
        description: 'Read a non-sensitive corporate homologation status summary.',
        inputSchema: corporateReadonlyInputSchema,
        outputSchema: corporateReadonlyOutputSchema,
        inferredRiskLevel: 'low',
        requiresApproval: false,
        defaultPolicy: {
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
        },
      }],
      diff: { added: [corporateReadonlyToolName], changed: [], removed: [] },
      warnings: [],
    };
  }

  async executeReadonlyTool(input: McpRemoteReadonlyTransportInput): Promise<McpRemoteReadonlyTransportOutput> {
    if (input.toolName !== corporateReadonlyToolName) {
      throw new AppError(409, 'MCP_REMOTE_TOOL_OPERATION_BLOCKED', 'Corporate read-only tool is not allowlisted.');
    }
    const scope = normalizedScope(input.input, this.maxRequestBytes);
    const pathname = scope === 'availability' ? '/v1/status/availability' : '/v1/status';
    const { value, bytes } = await this.getJson(input, pathname);
    const content = JSON.stringify(sanitizedStatus(value, pathname));
    return { content, responseBytes: bytes, simulated: false };
  }
}
