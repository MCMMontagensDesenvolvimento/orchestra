# Orchestra - Frontend

Status: operacional pos-higienizacao.

## Localizacao

O frontend esta em `/frontend`.

## Stack

- React 18.
- TypeScript.
- Vite.
- Tailwind CSS.
- shadcn/ui e Radix UI.
- TanStack Query.
- Vitest.
- ESLint.

## Ambiente Local

- Package manager: npm.
- Lockfile: `frontend/package-lock.json`.
- Vite: `host: "0.0.0.0"`, `port: 5173`, `strictPort: true`.
- Mocks ligados por padrao em `.env.example`.

## Validacao Atual

Na higienizacao inicial, os comandos abaixo passaram:

```bash
npx tsc --noEmit
npm run build
npm run lint
npx vitest run
```

## Limites

O frontend ainda nao esta integrado a backend real. Auth real, banco, RAG real, MCP real, providers reais e runtime real ainda serao definidos.

