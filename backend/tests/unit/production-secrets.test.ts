import { describe, expect, it } from 'vitest';
import { productionJwtSecretIssue } from '../../src/config/production-secrets';

describe('production secret validation', () => {
  it('rejects missing-strength and placeholder JWT secrets in production', () => {
    expect(productionJwtSecretIssue('production', 'short-secret')).toContain('at least 32 characters');
    expect(
      productionJwtSecretIssue('production', 'change-me-in-production-with-padding'),
    ).toContain('placeholder');
    expect(productionJwtSecretIssue('production', ' '.repeat(40))).toContain('at least 32 characters');
    expect(productionJwtSecretIssue('production', 'a'.repeat(40))).toContain('diversity');
  });

  it('accepts a strong production JWT secret without exposing it', () => {
    expect(
      productionJwtSecretIssue('production', 'a-strong-production-value-with-adequate-entropy-42'),
    ).toBeUndefined();
  });

  it('keeps controlled development and test defaults compatible', () => {
    expect(productionJwtSecretIssue('development', 'change-me-in-production')).toBeUndefined();
    expect(productionJwtSecretIssue('test', 'test-secret')).toBeUndefined();
  });
});
