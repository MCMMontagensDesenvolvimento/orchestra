import type { ZodType } from 'zod';
import {
  normalizeAgnoRuntimeHttpBaseUrl,
  normalizeAgnoRuntimeHttpSecurityKey,
} from '../../config/agno-runtime-http-security';
import {
  runtimeCapabilitiesResponseV1Schema,
  runtimeExecuteRequestV1Schema,
  runtimeExecuteResponseV1Schema,
  runtimeHealthResponseV1Schema,
} from './runtime-contract.schema';
import type {
  RuntimeCapabilitiesResponseV1,
  RuntimeExecuteRequestV1,
  RuntimeExecuteResponseV1,
  RuntimeHealthResponseV1,
  RuntimeNormalizedErrorV1,
} from './runtime-contract.types';

interface AgnoHttpRuntimeClientOptions {
  baseUrl: string;
  timeoutMs: number;
  securityKey?: string;
  healthPath?: string;
  capabilitiesPath?: string;
  executePath?: string;
}

type AgnoHttpMethod = 'GET' | 'POST';
type RuntimeErrorCode = RuntimeNormalizedErrorV1['code'];

export class AgnoHttpRuntimeClientError extends Error {
  readonly code: RuntimeErrorCode;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    code: RuntimeErrorCode;
    message: string;
    httpStatus?: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'AgnoHttpRuntimeClientError';
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

export class AgnoHttpRuntimeClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly securityKey?: string;
  private readonly healthPath: string;
  private readonly capabilitiesPath: string;
  private readonly executePath: string;

  constructor(options: AgnoHttpRuntimeClientOptions) {
    this.baseUrl = normalizeAgnoRuntimeHttpBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs;
    this.securityKey = normalizeAgnoRuntimeHttpSecurityKey(options.securityKey);
    this.healthPath = options.healthPath ?? '/health';
    this.capabilitiesPath = options.capabilitiesPath ?? '/capabilities';
    this.executePath = options.executePath ?? '/execute';
  }

  getHealth(): Promise<RuntimeHealthResponseV1> {
    return this.request('GET', this.healthPath, undefined, runtimeHealthResponseV1Schema);
  }

  getCapabilities(): Promise<RuntimeCapabilitiesResponseV1> {
    return this.request('GET', this.capabilitiesPath, undefined, runtimeCapabilitiesResponseV1Schema);
  }

  async execute(payload: RuntimeExecuteRequestV1): Promise<RuntimeExecuteResponseV1> {
    const request = runtimeExecuteRequestV1Schema.parse(payload);
    return this.request('POST', this.executePath, request, runtimeExecuteResponseV1Schema, sanitizeRuntimeExecuteResponsePayload);
  }

  private endpoint(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  private async request<T>(
    method: AgnoHttpMethod,
    path: string,
    body: unknown,
    schema: ZodType<T>,
    sanitizeResponse?: (value: unknown) => unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.securityKey) headers.Authorization = `Bearer ${this.securityKey}`;

    try {
      const response = await fetch(this.endpoint(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const json = parseJson(await response.text());
      if (containsConfiguredValue(json, this.securityKey) || containsConfiguredValue(json, this.baseUrl)) {
        throw new AgnoHttpRuntimeClientError({
          code: 'RUNTIME_INVALID_RESPONSE',
          message: 'Agno HTTP runtime returned a response containing private transport configuration.',
          retryable: false,
        });
      }

      if (!response.ok) {
        throw errorFromHttpResponse(response.status, json);
      }

      const parsed = schema.safeParse(sanitizeResponse ? sanitizeResponse(json) : json);
      if (!parsed.success) {
        throw new AgnoHttpRuntimeClientError({
          code: 'RUNTIME_INVALID_RESPONSE',
          message: 'Agno HTTP runtime returned a payload outside the runtime contract.',
          retryable: false,
          details: {
            issueCount: parsed.error.issues.length,
          },
        });
      }

      return parsed.data;
    } catch (error) {
      if (error instanceof AgnoHttpRuntimeClientError) throw sanitizeClientError(error, this.securityKey, this.baseUrl);
      if (isAbortError(error)) {
        throw new AgnoHttpRuntimeClientError({
          code: 'RUNTIME_TIMEOUT',
          message: `Agno HTTP runtime request exceeded ${this.timeoutMs}ms.`,
          retryable: true,
        });
      }
      throw new AgnoHttpRuntimeClientError({
        code: 'RUNTIME_UNAVAILABLE',
        message: 'Agno HTTP runtime is unavailable.',
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function errorFromHttpResponse(status: number, json: unknown) {
  const parsed = runtimeExecuteResponseV1Schema.safeParse(json);
  if (parsed.success && parsed.data.error) {
    return new AgnoHttpRuntimeClientError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      httpStatus: status,
      retryable: parsed.data.error.retryable,
      details: {
        runtimeStatus: parsed.data.status,
      },
    });
  }

  return new AgnoHttpRuntimeClientError({
    code: codeFromHttpStatus(status),
    message: `Agno HTTP runtime returned HTTP ${status}.`,
    httpStatus: status,
    retryable: status >= 500,
  });
}

function codeFromHttpStatus(status: number): RuntimeErrorCode {
  if (status === 400 || status === 415 || status === 413) return 'RUNTIME_BAD_REQUEST';
  if (status === 403) return 'RUNTIME_POLICY_BLOCKED';
  if (status === 408 || status === 504) return 'RUNTIME_TIMEOUT';
  if (status >= 500) return 'RUNTIME_UNKNOWN_ERROR';
  return 'RUNTIME_UNAVAILABLE';
}

function parseJson(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AgnoHttpRuntimeClientError({
      code: 'RUNTIME_INVALID_RESPONSE',
      message: 'Agno HTTP runtime returned invalid JSON.',
      retryable: false,
    });
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function sanitizeRuntimeExecuteResponsePayload(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const sanitized: Record<string, unknown> = { ...value };

  if (isRecord(value.usage)) {
    const usage = sanitizeUsage(value.usage);
    if (Object.keys(usage).length > 0) {
      sanitized.usage = usage;
    } else {
      delete sanitized.usage;
    }
  }

  return sanitized;
}

function sanitizeUsage(value: Record<string, unknown>) {
  const usage: Record<string, unknown> = {};
  const inputTokens = safeNonNegativeInteger(value.inputTokens);
  const outputTokens = safeNonNegativeInteger(value.outputTokens);
  const totalTokens = safeNonNegativeInteger(value.totalTokens);
  const latencyMs = safeNonNegativeInteger(value.latencyMs);

  if (typeof inputTokens === 'number') usage.inputTokens = inputTokens;
  if (typeof outputTokens === 'number') usage.outputTokens = outputTokens;
  if (typeof totalTokens === 'number') usage.totalTokens = totalTokens;
  if (typeof latencyMs === 'number') usage.latencyMs = latencyMs;

  if (typeof value.estimatedCostMinorUnits === 'string' && /^\d+$/.test(value.estimatedCostMinorUnits)) {
    usage.estimatedCostMinorUnits = value.estimatedCostMinorUnits.slice(0, 30);
  }
  if (typeof value.costCurrency === 'string' && /^[A-Z]{3}$/.test(value.costCurrency)) {
    usage.costCurrency = value.costCurrency;
  }

  return usage;
}

function safeNonNegativeInteger(value: unknown) {
  if (typeof value !== 'number') return undefined;
  if (!Number.isSafeInteger(value) || value < 0) return undefined;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function containsConfiguredValue(value: unknown, configuredValue: string | undefined, depth = 0): boolean {
  if (!configuredValue || depth > 8) return false;
  if (typeof value === 'string') return value.includes(configuredValue);
  if (Array.isArray(value)) return value.some((item) => containsConfiguredValue(item, configuredValue, depth + 1));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, item]) => (
    key.includes(configuredValue) || containsConfiguredValue(item, configuredValue, depth + 1)
  ));
}

function sanitizeClientError(
  error: AgnoHttpRuntimeClientError,
  securityKey: string | undefined,
  baseUrl: string,
) {
  if (!containsConfiguredValue(error.message, securityKey) && !error.message.includes(baseUrl)) return error;
  return new AgnoHttpRuntimeClientError({
    code: error.code,
    message: 'Agno HTTP runtime request failed without exposing private transport configuration.',
    httpStatus: error.httpStatus,
    retryable: error.retryable,
  });
}
