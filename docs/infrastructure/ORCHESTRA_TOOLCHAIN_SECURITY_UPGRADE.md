# Orchestra Toolchain Security Upgrade

Status: aplicado na Fase 07B.1.
Data: 2026-06-15.

## Objetivo

Remediar vulnerabilidades de severidade alta reportadas por `npm audit --audit-level=high` na toolchain local de backend e frontend, mantendo o escopo restrito a dependencias de desenvolvimento, lockfiles e documentacao operacional.

## Escopo

Incluido nesta rodada:

- Backend: Vitest, Vite transitive e esbuild transitive usados por test/dev tooling.
- Frontend: Vite, Vitest e plugin React SWC.
- `package-lock.json` de backend e frontend.
- Documentacao de baseline e decisao tecnica.

Fora do escopo:

- Novas features de produto.
- Troca de package manager.
- Upgrade de React, React Router, Tailwind, Recharts ou runtime de aplicacao.
- Uso de `npm audit fix --force`.

## Baseline Antes Do Upgrade

| Area | Comando | Resultado inicial | Causa principal |
| --- | --- | --- | --- |
| Backend | `npm audit --audit-level=high` | falhou com 5 vulnerabilidades altas | cadeia `vitest`/`vite`/`esbuild` e `tsx` resolvendo `esbuild` vulneravel |
| Frontend | `npm audit --audit-level=high` | falhou com 1 alta e 1 moderada | `vite <=6.4.1` dependendo de `esbuild` vulneravel |

Arvore observada antes da correcao:

- Backend: `vitest@3.2.6`, `vite@7.3.5`, `tsx@4.22.4`, `esbuild@0.28.0` e `esbuild@0.27.7`.
- Frontend: `vite@5.4.21`, `vitest@3.2.6`, `@vitejs/plugin-react-swc@3.11.0`, `esbuild@0.21.5`.

## Upgrade Aplicado

Backend:

- `vitest`: `^3.2.4` para `^4.1.9`.
- `esbuild` transitive: resolvido para `0.28.1`, inclusive na cadeia do `tsx`.
- `vite` transitive de Vitest: resolvido para `8.0.16`.

Frontend:

- `vite`: `^5.4.19` para `^8.0.16`.
- `vitest`: `^3.2.4` para `^4.1.9`.
- `@vitejs/plugin-react-swc`: `^3.11.0` para `^4.3.1`.

## Compatibilidade

- Ambiente local validado com Node.js `v20.19.2` e npm `10.8.2`.
- Vite `8.0.16` declara suporte a Node `^20.19.0 || >=22.12.0`.
- Vitest `4.1.9` declara suporte a Node `^20.0.0 || ^22.0.0 || >=24.0.0`.
- O package manager permanece `npm`.
- O build do frontend emitiu apenas recomendacao nao bloqueante do `@vitejs/plugin-react-swc` sobre avaliar `@vitejs/plugin-react` em fase futura de performance/tooling.

## Resultado Depois Do Upgrade

| Area | Arvore final relevante | Audit |
| --- | --- | --- |
| Backend | `vitest@4.1.9`, `vite@8.0.16`, `tsx@4.22.4`, `esbuild@0.28.1` | `found 0 vulnerabilities` |
| Frontend | `vite@8.0.16`, `vitest@4.1.9`, `@vitejs/plugin-react-swc@4.3.1` | `found 0 vulnerabilities` |

## Validacoes Executadas

Backend:

- `npm run lint`
- `npm run typecheck`
- `npm test -- --run` - 10 arquivos, 63 testes aprovados.
- `npm run build`
- `npm run prisma:generate`
- `npx prisma validate`
- `npm audit --audit-level=high`

Frontend:

- `npm run lint`
- `npm run typecheck`
- `npm test -- --run` - 4 arquivos, 5 testes aprovados.
- `npm run build`
- `npm audit --audit-level=high`

Fullstack:

- `docker compose -f docker-compose.dev.yml config`
- `docker compose -f docker-compose.prod.yml config`
- `docker compose -f docker-compose.dev.yml up -d --build db backend frontend`
- `docker compose -f docker-compose.dev.yml exec -T backend npm run prisma:migrate:deploy`
- `docker compose -f docker-compose.dev.yml exec -T backend npm run prisma:seed`
- `./scripts/smoke-local.sh`
- `./scripts/smoke-agno-local.sh`

Todos os comandos acima foram concluidos com sucesso.

## Guardrails Mantidos

- `npm audit fix --force` nao foi usado.
- Nenhum teste, smoke ou coverage foi removido.
- Nenhuma feature de runtime, RAG, MCP, Agno ou UI foi adicionada.
- Nenhuma configuracao de segredo foi alterada.
