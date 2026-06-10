# Orchestra Frontend

Frontend web do Orchestra, construido com React, TypeScript, Vite, Tailwind CSS,
shadcn/ui, Radix UI, TanStack Query, ESLint e Vitest.

O frontend ainda usa mocks por padrao enquanto backend, banco, autenticacao
real, RAG real, MCP real e runtime real nao estao implementados.

## Instalar

```bash
npm install
```

## Rodar

```bash
npm run dev
```

Servidor local: `http://localhost:5173`.

## Ambiente

Copie `.env.example` para `.env` para desenvolvimento local. Nao versionar
`.env` e nao incluir tokens, API keys ou secrets.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run build:dev`
- `npm run lint`
- `npm run preview`
- `npm run test`
- `npm run test:watch`

## Validacao

```bash
npx tsc --noEmit
npm run build
npm run lint
npx vitest run
```
