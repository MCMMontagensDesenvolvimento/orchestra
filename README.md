# Orchestra

Orchestra e uma plataforma corporativa para criacao, configuracao, publicacao,
uso, governanca e auditoria de assistentes de IA.

Este repositorio contem a base frontend exportada e preparada para evolucao
local. Nesta fase, o produto ainda usa mocks controlados por variaveis
`VITE_*`; backend real, banco de dados, autenticacao real, RAG real, MCP real e
runtime real ainda nao estao implementados.

## Estrutura

- `frontend`: aplicacao web React/Vite.
- `backend`: reservado para fases futuras.
- `docs`: documentacao tecnica e de produto.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui e Radix UI
- TanStack Query
- Vitest
- ESLint

## Requisitos

- Node.js 20 LTS recomendado.
- npm 10+.

## Configuracao

```bash
cd frontend
npm install
cp .env.example .env
```

O arquivo `.env` e local e nao deve ser versionado. Use `.env.example` como
referencia segura, sem tokens, API keys ou secrets.

## Rodar localmente

```bash
cd frontend
npm run dev
```

O Vite roda em `http://localhost:5173`, com `host` configurado para
`0.0.0.0` para uso em WSL/Docker.

## Variaveis de ambiente

- `VITE_API_BASE_URL`: base URL futura da API.
- `VITE_APP_NAME`: nome publico do app.
- `VITE_APP_ENV`: ambiente atual.
- `VITE_USE_MOCKS`: liga ou desliga dados mockados.
- `VITE_MOCK_DELAY_MS`: atraso artificial dos mocks.
- `VITE_MOCK_SCENARIO`: cenario mockado padrao.
- `VITE_ENABLE_DEMO_MODE`: habilita modo demo.
- `VITE_ENABLE_PWA`: controla recursos PWA futuros.
- `VITE_DEFAULT_LOCALE`: locale padrao.
- `VITE_DEFAULT_TIMEZONE`: timezone padrao.

## Scripts

- `npm run dev`: inicia o servidor Vite.
- `npm run build`: gera build de producao.
- `npm run build:dev`: gera build em modo development.
- `npm run lint`: executa ESLint.
- `npm run preview`: serve o build localmente.
- `npm run test`: executa Vitest uma vez.
- `npm run test:watch`: executa Vitest em modo watch.

## Validacao

```bash
cd frontend
npx tsc --noEmit
npm run build
npm run lint
npx vitest run
```
