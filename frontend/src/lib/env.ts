/**
 * Leitor central de variaveis de ambiente do frontend.
 * Mock mode e opt-in e bloqueado fora de ambientes locais/teste.
 */

export type MockScenario = 'success' | 'empty' | 'error' | 'forbidden';

export interface FrontendEnvSource {
  MODE?: string;
  VITE_APP_ENV?: string;
  VITE_API_BASE_URL?: string;
  VITE_USE_MOCKS?: string;
  VITE_MOCK_DELAY_MS?: string;
  VITE_MOCK_SCENARIO?: string;
}

const mockAllowedEnvironments = new Set(['test', 'local', 'development', 'dev', 'prototype', 'prototipo']);
const productionLikeEnvironments = new Set(['staging', 'homolog', 'homologation', 'production', 'prod']);
const mockScenarios = new Set<MockScenario>(['success', 'empty', 'error', 'forbidden']);

const normalizeEnvironment = (value: string | undefined) => value?.trim().toLowerCase() || 'unknown';
const explicitlyEnabled = (value: string | undefined) => value?.trim().toLowerCase() === 'true';

const parseMockDelay = (value: string | undefined) => {
  const parsed = Number(value ?? 400);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 400;
};

const parseMockScenario = (value: string | undefined): MockScenario => {
  const scenario = value?.trim().toLowerCase() as MockScenario | undefined;
  return scenario && mockScenarios.has(scenario) ? scenario : 'success';
};

export function createFrontendEnv(source: FrontendEnvSource) {
  const appEnv = normalizeEnvironment(source.VITE_APP_ENV ?? source.MODE);
  const isProductionLike = productionLikeEnvironments.has(appEnv);
  const mockModeAllowed = mockAllowedEnvironments.has(appEnv);
  const mockModeRequested = explicitlyEnabled(source.VITE_USE_MOCKS);
  const mockModeBlockedReason = mockModeRequested && !mockModeAllowed
    ? `Mock mode is not allowed for application environment "${appEnv}". Set VITE_USE_MOCKS=false.`
    : null;

  if (mockModeBlockedReason) {
    throw new Error(mockModeBlockedReason);
  }

  return {
    appEnv,
    isProductionLike,
    useMocks: mockModeRequested && mockModeAllowed,
    mockModeAllowed,
    mockModeBlockedReason,
    mockDelayMs: parseMockDelay(source.VITE_MOCK_DELAY_MS),
    mockScenario: parseMockScenario(source.VITE_MOCK_SCENARIO),
    apiBaseUrl: source.VITE_API_BASE_URL?.trim() || '/api/v1',
  } as const;
}

export const env = createFrontendEnv(import.meta.env);
