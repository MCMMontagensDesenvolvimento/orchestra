# Fase 18D — MCP/Tools governado local

## Objetivo

A Fase 18D torna o MCP Hub homologável sem depender de servidor MCP remoto, produção, provider externo, embeddings ou execução real de Chat/AgentRun. A entrega instala, por seed local opt-in, um catálogo determinístico e auditável que usa as tabelas MCP já existentes; o Prisma schema e as migrations permanecem inalterados.

## Catálogo demo

O comando local abaixo usa o mesmo bloqueio de ambiente do seed demo existente e é recusado em `production`, `prod`, `staging`, `homolog` e `homologation`. Para instalar ou realocar o catálogo no tenant `mcm` e workspace `principal` existentes, execute na raiz do repositório:

```bash
docker compose -f docker-compose.dev.yml exec backend \
  npm run prisma:seed:mcp-demo-local -- --tenant-slug mcm --workspace-slug principal
```

`--tenant-slug` e `--workspace-slug` devem ser informados juntos. O entrypoint lê ambas as flags de `process.argv`, procura o tenant pelo slug e procura o workspace pelo slug composto com o ID desse tenant. Se algum alvo explícito não existir, o seed falha com mensagem clara, antes de criar qualquer fallback.

Sem essas flags, o seed prefere um par `mcm/principal` já existente. Se o par completo não existir, preserva o bootstrap local anterior, criando ou reutilizando `orchestra-dev/default` de forma idempotente. O log final informa `target=explicit`, `target=preferred-local` ou `target=fallback-local` para tornar a decisão verificável.

O seed `backend/prisma/mcp-local-demo.seed.ts` é idempotente: servidor, policies, tools, bindings e evidência de auditoria usam IDs fixos e `upsert`. Reexecutá-lo restaura as invariantes fail-closed.

Servidor instalado:

- nome: `MCP Demo Local — Corporate Readonly`;
- tipo: `local`;
- status visual: `active`, `configured`, `healthy`, `ready`;
- sem `baseUrl`, `secretRef` ou transporte externo;
- catálogo protegido contra update/archive/criação de filhos pela API e pela UI.

Tools instaladas:

1. `corporate.status.read`: status corporativo sanitizado/determinístico;
2. `corporate.policy.lookup`: consulta a uma política demonstrativa local;
3. `corporate.document.search.placeholder`: placeholder sem RAG e sem embeddings reais.

Todas têm `riskLevel=low`, `requiresApproval=true`, `isEnabled=true` apenas para catálogo/binding e metadata `localDemo=true`, `readOnly=true`, `localStub=true`, `deterministic=true`, `writeOperation=false` e `executionMode=precheck_only`.

## Policies e limites

As policies do servidor e das três tools reimpõem:

| Controle | Valor |
|---|---:|
| `readOnly` | `true` |
| `sandboxOnly` | `true` |
| `requiresApproval` | `true` |
| `blockedByDefault` | `true` |
| `allowRuntimeExecution` | `false` |
| `remoteExecution` | `false` |
| `writeToolsAllowed` | `false` |
| `externalNetworkAllowed` | `false` |
| `externalProviderAllowed` | `false` |
| `realEmbeddingsAllowed` | `false` |
| `chatAgentRunAllowed` | `false` |

Não existe executor de tool local novo. O precheck retorna `ready`, mas também `allowed=false` e `failClosed=true`. Assim, readiness visual não significa autorização de execução.

Se uma tool demo for enviada ao endpoint genérico de tool calls, o serviço interrompe o fluxo antes de persistir a chamada e responde `409 MCP_LOCAL_DEMO_PRECHECK_ONLY`, com auditoria `mcp.precheck.blocked`.

## Bindings

O seed cria três bindings entre `Assistant Foundation Example` e as tools, todos com `mode=sandbox_only` e `requiresApprovalOverride=true`. A API `GET /api/v1/mcp/bindings` permite ao Hub listar esses vínculos.

Bindings adicionais para esse servidor só passam pelo serviço quando apontam para uma tool demo explícita, preservam `sandbox_only` e não removem approval. Os bindings seedados e o catálogo seedado são imutáveis; o seed é o mecanismo de restauração. Não há execução remota nem write tool.

## Endpoints e auditoria

| Endpoint | Uso na 18D | Efeito externo |
|---|---|---:|
| `GET /api/v1/mcp/servers` | cards/lista/filtros | nenhum |
| `GET /api/v1/mcp/servers/:id` | detalhe do servidor | nenhum |
| `GET /api/v1/mcp/servers/:id/tools` | catálogo de tools | nenhum |
| `GET /api/v1/mcp/bindings` | bindings do Hub | nenhum |
| `GET /api/v1/mcp/servers/:id/local-demo-precheck` | readiness/policies determinísticas | nenhum |

Evidências allowlistadas:

- `mcp.demo.seeded`, idempotente no seed;
- `mcp.server.viewed` ao abrir o detalhe;
- `mcp.tool.catalog.viewed` ao carregar as tools;
- `mcp.precheck.demo_checked` ao executar somente o precheck.

Os eventos registram apenas IDs, contagens, status e flags de policy. Cookies, tokens, headers, secrets, payload bruto e inputs de tool não são gravados por esse fluxo.

## Frontend

`/app/mcp` passa a mostrar o servidor demo, contagens, filtros e badges `local`, `demo`, `read-only` e `sandbox`. O registro direto fica desabilitado nessa superfície da 18D e o menu do servidor seedado expõe somente o detalhe.

`/app/mcp/:id` mostra:

- status/ready e badges de origem;
- as três tools e seus schemas;
- approval obrigatório e edição desabilitada;
- bindings `sandbox_only`;
- ausência intencional de logs de execução;
- policies fail-closed;
- botão **Verificar precheck local**, que chama somente o endpoint determinístico e exibe `execução permitida: não`.

O modo mock opt-in do frontend usa `mcp-demo-local.mock.ts`, com o mesmo catálogo e zero logs de execução.

## Testes e gates

Testes direcionados:

- `backend/tests/unit/mcp-local-demo.test.ts`: parser de argumentos, resolução explícita/preferencial/final, erros sem fallback, catálogo, flags e seed repetido por `upsert`;
- `backend/tests/api/knowledge-mcp-catalog.test.ts`: precheck fail-closed, proteção do catálogo e listagem de bindings;
- `frontend/src/services/mocks/mcp-demo-local.mock.test.ts`: render data do servidor/tools/bindings e ausência de execução.

Validações:

```bash
git diff --check
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix backend run typecheck
npm --prefix backend run test -- tests/unit/mcp-local-demo.test.ts tests/api/knowledge-mcp-catalog.test.ts --run
npm --prefix frontend run test -- src/services/mocks/mcp-demo-local.mock.test.ts --run
scripts/smoke-mcp-tools-governado-local-18d.sh --dry-run
scripts/preflight-mcp-tools-governado-local-18d.sh --dry-run
scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run
```

O CI executa somente o smoke 18D offline em `--dry-run`; não executa seed, banco, Docker Compose, browser, rede, migration, MCP, provider, embeddings, Chat/AgentRun ou deploy.

## Fora de escopo

- MCP remoto/corporativo real;
- execução de qualquer uma das três tools;
- write tools;
- RAG/embeddings reais no placeholder de documentos;
- provider externo ou Agno real;
- Chat/AgentRun real;
- produção, deploy, Docker live e migration;
- edição visual do catálogo seedado.

Uma fase 18E pode avaliar CRUD de bindings pela UI e um executor local explicitamente aprovado. Isso não é necessário para homologar o catálogo/readiness governado entregue aqui.
