import { createHash } from 'crypto';

const unsafeKeyFragments = [
  'apikey',
  'authorization',
  'baseurl',
  'connectionstring',
  'cookie',
  'credential',
  'header',
  'password',
  'payload',
  'providerapikey',
  'prompt',
  'rawdocuments',
  'request',
  'response',
  'secret',
  'secretref',
  'token',
];

const sensitiveTextPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;
const sensitiveExcerptPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|(?:api[_-]?key|token|password|secret|credential)\s*[:=]\s*["']?[^"'\s,;]+)/gi;
const maxStringChars = 500;
const maxArrayItems = 25;
const maxObjectKeys = 40;
const maxDepth = 4;

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

export function hasUnsafeAiQualityMetadata(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return containsUnsafeText(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return true;
  if (depth > maxDepth) return true;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeAiQualityMetadata(item, depth + 1));
  if (!isRecord(value)) return true;

  return Object.entries(value).some(([key, entry]) => (
    isUnsafeKey(key) || hasUnsafeAiQualityMetadata(entry, depth + 1)
  ));
}

export function sanitizeAiQualityMetadata(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return containsUnsafeText(value) ? '[redacted]' : value.slice(0, maxStringChars);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  if (depth >= maxDepth) return '[truncated]';

  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((item) => sanitizeAiQualityMetadata(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }

  if (!isRecord(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort().slice(0, maxObjectKeys)) {
    if (isUnsafeKey(key)) continue;
    const sanitizedValue = sanitizeAiQualityMetadata(value[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}

export function sanitizeAiQualityTextExcerpt(value: string, maxChars = 240) {
  const compact = value.trim().replace(/\s+/g, ' ');
  if (!compact) return null;
  const sanitized = compact.replace(sensitiveExcerptPattern, '[redacted]');
  return sanitized.slice(0, maxChars);
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function approximateJsonSize(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
