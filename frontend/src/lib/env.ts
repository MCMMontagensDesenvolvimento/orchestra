/**
 * Leitor central de variáveis de ambiente do frontend.
 * Mantém defaults seguros para que o protótipo funcione mesmo sem .env.
 */

const truthy = (v: string | undefined, fallback: boolean) =>
  v == null || v === '' ? fallback : v.toLowerCase() === 'true';

export type MockScenario = 'success' | 'empty' | 'error' | 'forbidden';

export const env = {
  useMocks: truthy(import.meta.env.VITE_USE_MOCKS, true),
  mockDelayMs: Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 400),
  mockScenario: ((import.meta.env.VITE_MOCK_SCENARIO ?? 'success') as MockScenario),
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
} as const;
