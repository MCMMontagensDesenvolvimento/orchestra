const minimumProductionJwtSecretLength = 32;

const rejectedProductionJwtSecrets = new Set([
  'change-me',
  'change-me-in-production',
  'changeme',
  'default',
  'jwt-secret',
  'secret',
  'test-secret',
  'test-secret-change-me',
]);

export function productionJwtSecretIssue(nodeEnv: string, secret: string): string | undefined {
  if (nodeEnv !== 'production') return undefined;

  const trimmedSecret = secret.trim();
  const normalizedSecret = trimmedSecret.toLowerCase();
  if (trimmedSecret.length < minimumProductionJwtSecretLength) {
    return `JWT_SECRET must contain at least ${minimumProductionJwtSecretLength} characters in production.`;
  }
  if (
    rejectedProductionJwtSecrets.has(normalizedSecret)
    || normalizedSecret.includes('change-me')
    || normalizedSecret.includes('placeholder')
  ) {
    return 'JWT_SECRET must not use a default or placeholder value in production.';
  }
  if (new Set(trimmedSecret).size < 8) {
    return 'JWT_SECRET must contain sufficient character diversity in production.';
  }
  return undefined;
}
