import { createHash } from 'crypto';
import { AppError } from '../../shared/errors/app-error';
import { aiObservabilityRepository } from './ai-observability.repository';
import type {
  AiObservabilityRepository,
  AiUsageEventInput,
  AiUsageEventSource,
  AiUsageEventStatus,
  NormalizedAiUsageEventInput,
} from './ai-observability.types';
import {
  aiUsageEventSourceValues,
  aiUsageEventStatusValues,
} from './ai-observability.types';

const unsafeKeyFragments = [
  'apikey',
  'authorization',
  'baseurl',
  'connectionstring',
  'cookie',
  'credential',
  'header',
  'password',
  'prompt',
  'rawdocuments',
  'request',
  'response',
  'secret',
  'secretref',
  'token',
];

const sensitiveTextPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;
const maxStringChars = 500;
const maxArrayItems = 25;
const maxObjectKeys = 40;
const maxDepth = 4;
const maxShortStringChars = 160;
const hexSha256Pattern = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedKey(key: string) {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function isUnsafeKey(key: string) {
  const normalized = normalizedKey(key);
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment));
}

function containsUnsafeText(value: string) {
  const normalized = value.toLowerCase();
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment)) || sensitiveTextPattern.test(value);
}

export function sanitizeAiUsageMetadata(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return containsUnsafeText(value) ? '[redacted]' : value.slice(0, maxStringChars);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  if (depth >= maxDepth) return '[truncated]';

  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((item) => sanitizeAiUsageMetadata(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }

  if (!isRecord(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort().slice(0, maxObjectKeys)) {
    if (isUnsafeKey(key)) continue;
    const sanitizedValue = sanitizeAiUsageMetadata(value[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}

function shortString(value: unknown, max = maxShortStringChars) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function normalizeSource(value: unknown): AiUsageEventSource {
  return aiUsageEventSourceValues.includes(value as AiUsageEventSource) ? value as AiUsageEventSource : 'unknown';
}

function normalizeStatus(value: unknown): AiUsageEventStatus {
  return aiUsageEventStatusValues.includes(value as AiUsageEventStatus) ? value as AiUsageEventStatus : 'started';
}

function nonNegativeInt(value: unknown) {
  if (value === null || typeof value === 'undefined') return undefined;
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return undefined;
  return Math.floor(numberValue);
}

function normalizeDate(value: Date | string | null | undefined, fallback?: Date) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return fallback;
}

function normalizeCurrency(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
}

function normalizeMinorUnits(value: unknown) {
  if (value === null || typeof value === 'undefined') return undefined;
  try {
    if (typeof value === 'bigint') return value >= 0n ? value : undefined;
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value < 0) return undefined;
      return BigInt(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  } catch {
    return undefined;
  }
  return undefined;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeErrorMessageHash(input: AiUsageEventInput) {
  if (typeof input.errorMessageHash === 'string' && hexSha256Pattern.test(input.errorMessageHash)) return input.errorMessageHash;
  if (typeof input.errorMessage === 'string' && input.errorMessage.trim()) return sha256(input.errorMessage.trim().slice(0, 2000));
  return undefined;
}

export function normalizeAiUsageEventInput(input: AiUsageEventInput): NormalizedAiUsageEventInput {
  const tenantId = shortString(input.tenantId, 80);
  const workspaceId = shortString(input.workspaceId, 80);
  const runId = shortString(input.runId, 160);
  const operation = shortString(input.operation, 80);

  if (!tenantId || !workspaceId || !runId || !operation) {
    throw new AppError(422, 'AI_USAGE_EVENT_INVALID', 'tenantId, workspaceId, runId e operation sao obrigatorios.');
  }

  const inputTokens = nonNegativeInt(input.inputTokens);
  const outputTokens = nonNegativeInt(input.outputTokens);
  const totalTokens = nonNegativeInt(input.totalTokens) ?? (
    typeof inputTokens === 'number' && typeof outputTokens === 'number' ? inputTokens + outputTokens : undefined
  );
  const normalizedCostCurrency = normalizeCurrency(input.costCurrency ?? input.cost?.currency);
  const normalizedCostMinorUnits = normalizeMinorUnits(input.estimatedCostMinorUnits ?? input.cost?.minorUnits);
  const hasReliableCostPair = Boolean(normalizedCostCurrency) && typeof normalizedCostMinorUnits === 'bigint';
  const costCurrency = hasReliableCostPair ? normalizedCostCurrency : undefined;
  const estimatedCostMinorUnits = hasReliableCostPair ? normalizedCostMinorUnits : undefined;
  const startedAt = normalizeDate(input.startedAt, new Date())!;

  return {
    tenantId,
    workspaceId,
    assistantId: shortString(input.assistantId, 80),
    userId: shortString(input.userId, 80),
    runId,
    traceId: shortString(input.traceId, 160),
    source: normalizeSource(input.source),
    operation,
    provider: shortString(input.provider, 80),
    model: shortString(input.model, 160),
    status: normalizeStatus(input.status),
    blockedReason: shortString(input.blockedReason, 160),
    errorCode: shortString(input.errorCode, 120),
    errorMessageHash: normalizeErrorMessageHash(input),
    inputTokens,
    outputTokens,
    totalTokens,
    embeddingTokens: nonNegativeInt(input.embeddingTokens),
    cachedTokens: nonNegativeInt(input.cachedTokens),
    latencyMs: nonNegativeInt(input.latencyMs),
    costCurrency,
    estimatedCostMinorUnits,
    metadata: sanitizeAiUsageMetadata(input.metadata),
    startedAt,
    completedAt: normalizeDate(input.completedAt),
  };
}

export class AiObservabilityService {
  constructor(private readonly repository: AiObservabilityRepository = aiObservabilityRepository) {}

  async recordAiUsageEvent(input: AiUsageEventInput) {
    const normalized = normalizeAiUsageEventInput(input);
    return this.repository.createUsageEvent(normalized);
  }
}

export const aiObservabilityService = new AiObservabilityService();

export function recordAiUsageEvent(input: AiUsageEventInput) {
  return aiObservabilityService.recordAiUsageEvent(input);
}
