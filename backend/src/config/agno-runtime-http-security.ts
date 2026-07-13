export const agnoRuntimeHttpTimeoutMinMs = 1_000;
export const agnoRuntimeHttpTimeoutMaxMs = 120_000;

export function normalizeAgnoRuntimeHttpBaseUrl(value: string): string {
  const candidate = value.trim();
  if (!candidate) throw new Error('Agno runtime HTTP base URL is required.');

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Agno runtime HTTP base URL is invalid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Agno runtime HTTP base URL must use http or https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Agno runtime HTTP base URL must not contain embedded credentials.');
  }
  if (candidate.includes('?') || candidate.includes('#')) {
    throw new Error('Agno runtime HTTP base URL must not contain a query string or fragment.');
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${normalizedPath}`;
}

export function normalizeAgnoRuntimeHttpSecurityKey(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const candidate = value.trim();
  if (
    candidate.length < 16
    || candidate.length > 512
    || !/^[A-Za-z0-9._~+\/-]+=*$/.test(candidate)
  ) {
    throw new Error('Agno runtime HTTP security key must be a valid bearer token between 16 and 512 characters.');
  }
  return candidate;
}
