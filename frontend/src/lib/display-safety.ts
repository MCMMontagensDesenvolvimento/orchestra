const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function compactTechnicalId(value: string | null | undefined, visibleChars = 8): string {
  const normalized = value?.trim();

  if (!normalized) return 'Não informado';
  if (normalized.length <= visibleChars * 2 + 1) return normalized;

  return `${normalized.slice(0, visibleChars)}…${normalized.slice(-visibleChars)}`;
}

export function humanizeTechnicalToken(value: string | null | undefined, fallback = 'Registro técnico'): string {
  const normalized = value?.trim();

  if (!normalized) return fallback;

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function displayUserLabel(value: string | null | undefined, fallback = 'Sistema'): string {
  const normalized = value?.trim();

  if (!normalized) return fallback;
  if (isUuid(normalized)) return 'Usuário interno';

  return normalized;
}

export function displayResourceLabel(entity: string | null | undefined, entityId: string | null | undefined): string {
  const entityLabel = humanizeTechnicalToken(entity, 'Registro técnico');
  const normalizedEntityId = entityId?.trim();

  if (!normalizedEntityId) return entityLabel;
  if (isUuid(normalizedEntityId)) return `${entityLabel} · ref. ${compactTechnicalId(normalizedEntityId)}`;

  return `${entityLabel} · ${normalizedEntityId}`;
}

export function safeSummaryPreview(value: string | null | undefined, maxLength = 120): string {
  const normalized = value?.replace(/\s+/g, ' ').trim();

  if (!normalized) return 'Não informado';
  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
