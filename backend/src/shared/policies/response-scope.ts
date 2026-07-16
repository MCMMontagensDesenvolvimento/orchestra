export const responseScopeModeValues = ['knowledge_only', 'knowledge_first', 'general_allowed'] as const;

export type ResponseScopeMode = typeof responseScopeModeValues[number];

export const defaultResponseScopeMode: ResponseScopeMode = 'knowledge_first';

const responseScopeModes = new Set<string>(responseScopeModeValues);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function normalizeResponseScopeMode(value: unknown): ResponseScopeMode {
  return typeof value === 'string' && responseScopeModes.has(value)
    ? value as ResponseScopeMode
    : defaultResponseScopeMode;
}

export function responseScopeModeFromMetadata(metadata: unknown): ResponseScopeMode {
  return normalizeResponseScopeMode(asRecord(metadata)?.responseScopeMode);
}

export function mergeResponseScopeMetadata(
  metadata: unknown,
  mode: ResponseScopeMode = defaultResponseScopeMode,
): Record<string, unknown> {
  return {
    ...(asRecord(metadata) ?? {}),
    responseScopeMode: normalizeResponseScopeMode(mode),
  };
}
