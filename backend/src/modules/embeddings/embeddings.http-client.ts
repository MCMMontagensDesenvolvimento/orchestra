export interface EmbeddingHttpRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  timeoutMs: number;
}

export interface EmbeddingHttpResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export interface EmbeddingHttpClient {
  postJson(request: EmbeddingHttpRequest): Promise<EmbeddingHttpResponse>;
}

export class EmbeddingHttpTimeoutError extends Error {
  constructor() {
    super('Embedding provider request timed out.');
    this.name = 'EmbeddingHttpTimeoutError';
  }
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export const fetchEmbeddingHttpClient: EmbeddingHttpClient = {
  async postJson(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await fetch(request.url, {
        method: 'POST',
        signal: controller.signal,
        headers: request.headers,
        body: JSON.stringify(request.body),
      });

      return {
        ok: response.ok,
        status: response.status,
        body: await readJson(response),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EmbeddingHttpTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  },
};
