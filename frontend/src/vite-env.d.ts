/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Quando 'true', services usam mocks locais ao invés de chamar a API. */
  readonly VITE_USE_MOCKS?: string;
  /** Atraso simulado (ms) das respostas mockadas. */
  readonly VITE_MOCK_DELAY_MS?: string;
  /** Cenário global de mocks: 'success' | 'empty' | 'error' | 'forbidden'. */
  readonly VITE_MOCK_SCENARIO?: string;
  /** Base URL da API real (usada quando VITE_USE_MOCKS=false). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
