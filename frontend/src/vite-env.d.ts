/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ambiente funcional: local, development, test, staging ou production. */
  readonly VITE_APP_ENV?: string;
  /** Quando 'true', services usam mocks locais somente em ambiente permitido. */
  readonly VITE_USE_MOCKS?: string;
  /** Atraso simulado (ms) das respostas mockadas. */
  readonly VITE_MOCK_DELAY_MS?: string;
  /** Cenário global de mocks: 'success' | 'empty' | 'error' | 'forbidden'. */
  readonly VITE_MOCK_SCENARIO?: string;
  /** Base URL da API real (usada quando VITE_USE_MOCKS=false). */
  readonly VITE_API_BASE_URL?: string;
  /** Placeholder legado; ainda nao controla funcionalmente o frontend. */
  readonly VITE_ENABLE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
