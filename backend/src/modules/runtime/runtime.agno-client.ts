export interface AgnoRuntimeHealthResponse {
  status?: string;
  provider?: string;
  version?: string;
  capabilities?: Record<string, unknown>;
  message?: string;
}

export interface AgnoRuntimeCapabilitiesResponse {
  provider?: string;
  supportsTextGeneration?: boolean;
  supportsStreaming?: boolean;
  supportsRagContext?: boolean;
  supportsMcpTools?: boolean;
  supportsToolCalling?: boolean;
  supportsCitations?: boolean;
  supportsTraceEvents?: boolean;
  supportsSandbox?: boolean;
  supportsExternalProviders?: boolean;
}

export interface AgnoRuntimeEvent {
  type?: string;
  status?: string;
  message?: string;
  metadata?: unknown;
}

export interface AgnoRuntimeRequest {
  runId: string;
  traceId: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId: string | null;
  executionMode: string;
  input: {
    text: string;
    hash: string;
    preview: string;
  };
  assistant: {
    name: string;
    instructions: string;
    temperature: number | null;
    modelProvider?: string | null;
    modelName?: string | null;
  };
  policySnapshot: {
    mode: string;
    requiresApproval: boolean;
    externalToolsAllowed: boolean;
    remoteMcpAllowed: boolean;
    sandboxRequired: boolean;
  };
  ragContext?: {
    enabled: boolean;
    queryId: string | null;
    sources: Array<{
      citationLabel: string;
      documentTitle?: string | null;
      excerpt?: string | null;
      sourceUri?: string | null;
    }>;
  };
  mcpContext?: {
    enabled: boolean;
    tools: Array<{
      serverId: string;
      toolId: string;
      name: string;
      riskLevel: string;
      requiresApproval: boolean;
      executionMode: string;
    }>;
    toolCallingEnabled: boolean;
  };
  metadata: {
    orchestraRuntimeContractVersion: 'v1';
    realExternalProvidersAllowed: boolean;
    localRuntimeOnly: boolean;
  };
}

export interface AgnoRuntimeResponse {
  status?: string;
  output?: {
    text?: string;
    preview?: string;
    hash?: string;
  };
  message?: string;
  events?: AgnoRuntimeEvent[];
  usage?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface AgnoRuntimeClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  healthPath: string;
  capabilitiesPath: string;
  executePath: string;
}

export class AgnoRuntimeClientError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    code: string;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'AgnoRuntimeClientError';
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

export class AgnoRuntimeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly healthPath: string;
  private readonly capabilitiesPath: string;
  private readonly executePath: string;

  constructor(options: AgnoRuntimeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
    this.healthPath = options.healthPath;
    this.capabilitiesPath = options.capabilitiesPath;
    this.executePath = options.executePath;
  }

  getHealth() {
    return this.request<AgnoRuntimeHealthResponse>('GET', this.healthPath);
  }

  getCapabilities() {
    return this.request<AgnoRuntimeCapabilitiesResponse>('GET', this.capabilitiesPath);
  }

  executeRun(payload: AgnoRuntimeRequest) {
    return this.request<AgnoRuntimeResponse>('POST', this.executePath, payload);
  }

  private endpoint(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    try {
      const response = await fetch(this.endpoint(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      const json = parseJson(text);

      if (!response.ok) {
        throw new AgnoRuntimeClientError({
          code: 'AGNO_RUNTIME_HTTP_ERROR',
          message: `Agno runtime returned HTTP ${response.status}.`,
          statusCode: response.status,
          retryable: response.status >= 500,
          details: {
            responsePreview: text.slice(0, 200),
          },
        });
      }

      if (!isRecord(json)) {
        throw new AgnoRuntimeClientError({
          code: 'AGNO_RUNTIME_INVALID_RESPONSE',
          message: 'Agno runtime returned a non-object JSON response.',
        });
      }

      return json as T;
    } catch (error) {
      if (error instanceof AgnoRuntimeClientError) throw error;
      if (isAbortError(error)) {
        throw new AgnoRuntimeClientError({
          code: 'AGNO_RUNTIME_TIMEOUT',
          message: `Agno runtime request exceeded ${this.timeoutMs}ms.`,
          retryable: true,
        });
      }
      throw new AgnoRuntimeClientError({
        code: 'AGNO_RUNTIME_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Agno runtime request failed.',
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJson(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AgnoRuntimeClientError({
      code: 'AGNO_RUNTIME_INVALID_RESPONSE',
      message: 'Agno runtime returned invalid JSON.',
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}
