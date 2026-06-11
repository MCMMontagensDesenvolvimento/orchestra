# Orchestra Frontend Technical Debt And Bundle Health

Status: atualizado na Fase 05F.

## Objetivo Da Fase 05F

Reduzir divida tecnica do frontend sem alterar produto, backend, Prisma, runtime, providers, RAG, MCP ou SSO. A fase focou em bundle, lint, Fast Refresh, hooks e validacoes fullstack.

## Diagnostico Inicial

Stack local observado:

- React `18.3.1`.
- Vite `5.4.21`.
- TypeScript `5.9.3`.
- `@vitejs/plugin-react-swc` `3.11.0`.
- Build estatico via `frontend/Dockerfile.prod` e Nginx.
- Modo API real preservado por `VITE_USE_MOCKS=false`.
- Modo mock preservado por `VITE_USE_MOCKS=true`.

Antes da mudanca:

- `npm run lint`: 17 warnings, 0 errors.
- Warnings de Fast Refresh em primitives de UI com exports mistos.
- Warnings de hooks em Knowledge e MCP por dependencias incompletas ou instaveis.
- `npm run build`: 1 chunk JS principal com `1,189.87 kB`, gzip `330.36 kB`.
- Vite emitia alerta de chunks acima de `500 kB`.
- `npm audit --audit-level=high`: sem vulnerabilidade alta.
- `npm audit`: 2 vulnerabilidades moderadas em Vite/esbuild.

## Alteracoes Aplicadas

### Route-level Lazy Loading

`frontend/src/App.tsx` agora usa `React.lazy` + `Suspense` para paginas de rota:

- Auth/Login.
- Dashboard/Analytics.
- Assistants e detalhes.
- Knowledge.
- MCP.
- Chat.
- Audit/Admin.
- Error pages.

Layouts, providers e guards permanecem estaticos para manter a estrutura da aplicacao estavel. O fallback exibe `Carregando...` durante a carga do chunk de rota.

### UI Primitives E Fast Refresh

Exports auxiliares foram separados ou removidos quando eram internos:

- `buttonVariants` saiu para `frontend/src/components/ui/button-variants.ts`.
- `badgeVariants` saiu para `frontend/src/components/ui/badge-variants.ts`.
- `toggleVariants` saiu para `frontend/src/components/ui/toggle-variants.ts`.
- `navigationMenuTriggerStyle`, `useFormField`, `useSidebar` e `toast` deixaram de ser exports publicos dos arquivos de componente quando nao eram consumidos externamente.

Esse ajuste manteve o visual e reduziu ruido de Fast Refresh no lint.

### Hooks

Dependencias de `useEffect` e `useMemo` foram corrigidas em:

- `frontend/src/pages/Knowledge/KnowledgePage.tsx`.
- `frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx`.
- `frontend/src/pages/MCP/McpHubPage.tsx`.
- `frontend/src/pages/MCP/McpDetailPage.tsx`.

Arrays fallback em hooks foram estabilizados onde o lint apontava recriacao por render.

## Resultado De Bundle

Depois da mudanca:

- `npm run build`: sem alerta de chunk acima de `500 kB`.
- Maior chunk JS app/vendor: `383.98 kB`, gzip `126.17 kB`.
- Chunk de chart: `374.59 kB`, gzip `103.89 kB`.
- CSS: `68.86 kB`, gzip `12.16 kB`.
- Rotas passaram a gerar chunks dedicados, por exemplo `LoginPage`, `DashboardPage`, `AssistantsPage`, `AssistantDetailPage`, `McpHubPage`, `McpDetailPage` e `ChatPage`.

`manualChunks` nao foi adicionado porque o split por rota ja removeu o alerta de tamanho e manteve a configuracao do Vite mais simples. Se o bundle crescer novamente, a primeira divisao candidata e isolar `recharts` e vendor React/UI por `rollupOptions.output.manualChunks`.

## Console E Navegacao Manual

Validacao manual no navegador local:

- `/login`: carregou em desktop e mobile.
- Dev-login via botao `Entrar`: redirecionou para `/app/dashboard`.
- `/app/dashboard`: carregou em desktop e mobile.
- `/app/assistants`: carregou lista real em API mode.
- Link legado `/assistants/:id`: redirecionou para `/app/assistants/:id`.
- Assistant detail: carregou.
- Aba `Governanca`: carregou.
- Aba `Execucoes`: carregou.
- Mobile `390x844`: login, dashboard, assistants e detalhe renderizaram com root ativo.

Console:

- Erros: nenhum erro capturado.
- Warnings: apenas future flags conhecidos do React Router v7 (`v7_startTransition` e `v7_relativeSplatPath`).

## Validacoes Executadas

Frontend:

```bash
npm install
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm audit --audit-level=high
npm audit
npm outdated || true
```

Backend:

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npx prisma validate
```

Infra:

```bash
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.prod.yml config
docker build -f frontend/Dockerfile.prod -t orchestra-frontend:phase05f frontend
./scripts/smoke-local.sh
```

Resultados:

- Frontend lint/typecheck/tests/build passaram.
- Backend lint/typecheck/tests/build passaram.
- Prisma schema valido.
- Compose dev/prod validos.
- Docker build frontend prod passou.
- Smoke local fullstack passou.
- `npm audit` completo permanece com 2 moderadas em Vite/esbuild; ver documento de dependency hygiene.

## Pendencias Tecnicas

- Avaliar future flags do React Router em uma fase propria de upgrade de router.
- Planejar upgrade major de Vite e plugin SWC com matriz de regressao.
- Se o chunk de charts crescer, considerar importacao mais granular ou `manualChunks` para `recharts`.
- Acompanhar se os links legados de cards devem ser convertidos para `/app/*` em fase de limpeza de rotas.

