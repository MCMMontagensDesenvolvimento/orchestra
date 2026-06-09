import { env, type MockScenario } from '@/lib/env';
import { ApiError } from '@/services/api/api-error';

interface MockOptions {
  /** Sobrescreve o cenário global para uma resposta específica. */
  scenario?: MockScenario;
  /** Sobrescreve o delay (ms) para uma resposta específica. */
  delay?: number;
  /** Valor retornado quando o cenário é 'empty' (default: [] | null). */
  empty?: unknown;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Envolve um valor mock em uma Promise para se parecer com chamada de API,
 * respeitando o cenário global (success/empty/error/forbidden) e um delay.
 */
export async function mockResponse<T>(data: T, opts: MockOptions = {}): Promise<T> {
  const scenario = opts.scenario ?? env.mockScenario;
  const delay = opts.delay ?? env.mockDelayMs;
  if (delay > 0) await sleep(delay);

  switch (scenario) {
    case 'error':
      throw ApiError.server('Falha simulada (VITE_MOCK_SCENARIO=error).');
    case 'forbidden':
      throw ApiError.forbidden('Acesso negado (VITE_MOCK_SCENARIO=forbidden).');
    case 'empty':
      if (opts.empty !== undefined) return opts.empty as T;
      if (Array.isArray(data)) return [] as unknown as T;
      return null as unknown as T;
    case 'success':
    default:
      return data;
  }
}

/** Retorna um item por id ou lança 404. Respeita o cenário global. */
export async function mockFind<T extends { id: string }>(items: T[], id: string, opts: MockOptions = {}): Promise<T> {
  const list = await mockResponse(items, opts);
  const found = (list as T[]).find((i) => i.id === id);
  if (!found) throw ApiError.notFound(`Recurso ${id} não encontrado.`);
  return found;
}
