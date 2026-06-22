import { describe, expect, it } from 'vitest';
import { createFrontendEnv } from '@/lib/env';

describe('frontend mock mode environment policy', () => {
  it('keeps mocks disabled when VITE_USE_MOCKS is absent', () => {
    const result = createFrontendEnv({ VITE_APP_ENV: 'local' });

    expect(result.useMocks).toBe(false);
    expect(result.mockModeAllowed).toBe(true);
  });

  it('keeps mocks disabled when VITE_USE_MOCKS is false', () => {
    const result = createFrontendEnv({
      VITE_APP_ENV: 'local',
      VITE_USE_MOCKS: 'false',
    });

    expect(result.useMocks).toBe(false);
  });

  it('allows explicitly enabled mocks in local environment', () => {
    const result = createFrontendEnv({
      VITE_APP_ENV: 'local',
      VITE_USE_MOCKS: 'true',
    });

    expect(result.useMocks).toBe(true);
    expect(result.mockModeAllowed).toBe(true);
    expect(result.isProductionLike).toBe(false);
  });

  it('allows explicitly enabled mocks in test environment', () => {
    const result = createFrontendEnv({
      VITE_APP_ENV: 'test',
      VITE_USE_MOCKS: 'true',
    });

    expect(result.useMocks).toBe(true);
  });

  it.each(['staging', 'homolog', 'homologation', 'production', 'prod'])(
    'fails closed when mocks are requested in %s',
    (appEnv) => {
      expect(() => createFrontendEnv({
        VITE_APP_ENV: appEnv,
        VITE_USE_MOCKS: 'true',
      })).toThrow(`Mock mode is not allowed for application environment "${appEnv}".`);
    },
  );

  it('fails closed for an unknown environment when mocks are requested', () => {
    expect(() => createFrontendEnv({
      VITE_USE_MOCKS: 'true',
    })).toThrow('Mock mode is not allowed for application environment "unknown".');
  });
});
