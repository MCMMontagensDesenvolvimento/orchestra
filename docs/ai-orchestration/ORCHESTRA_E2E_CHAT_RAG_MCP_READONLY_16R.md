# Orchestra — E2E Chat/RAG/MCP Read-only 16R

## Objetivo

A Fase 16R fornece uma homologacao operacional, reproduzivel e versionada do fluxo `Chat/AgentRun -> RAG governado -> Agno bridge -> gateway Orchestra -> MCP demo HTTP read-only`, com observabilidade e auditoria sanitizadas. Ela prova a integracao das fases 16I–16Q; nao cria uma feature de negocio nem libera um conector externo.

O aceite estrito exige que o mesmo `AgentRun` registre `ragMode=resolved_context`, pelo menos uma fonte RAG e uma chamada MCP real com `externalMcpCalled=true`, `simulated=false`, `mcpRemoteAllowed=true`, `mcpRemoteReadOnly=true` e `rawContentLogged=false`.

## Escopo

- stack local com frontend, backend, PostgreSQL/pgvector, Agno bridge stub, harness E2E e `mcp-readonly-demo`;
- fixture ficticia em `runtime/e2e-fixtures/16r/catalogo-ficticio.md`;
- preparacao idempotente por APIs locais de assistant, execution policy, Knowledge Base, documento, ingestao e bindings;
- catalogo MCP local criado fechado por default, com abertura explicita e restrita a dois registros de policy da fixture;
- uma callback deterministica, autenticada e limitada a uma chamada para `catalog.search` ou `catalog.get_status`;
- validacao estrita pelo DTO de `/api/v1/ai-observability/runtime-runs/:id`;
- cenarios de bloqueio por flag/allowlist e por operacao de escrita;
- cleanup por remocao de bindings e arquivamento logico somente de objetos marcados como fixture 16R.

## Fora de escopo

- deploy, TLS/ingress, provider externo, conector corporativo ou URL corporativa;
- dado real, documento interno real, credencial real ou referencia a cofre real;
- tool de escrita, mutation, shell, envio de mensagem, aprovacao ou sincronizacao;
- alteracao do Prisma schema, migration, `migrate dev`, seed automatico ou reset de banco;
- mudanca da semantica Chat/RAG/Response Scope;
- habilitacao MCP remota no compose de producao ou nos `.env.example`;
- execucao ampla de tools, discovery livre ou mais de uma tool call;
- exclusao de runs, tool calls e audit logs historicos.

## Arquitetura E2E

```text
Operador -> script 16R -> API Orchestra (cookie HttpOnly local)
                              |
                              +-> Knowledge/RAG governado -> chunks/source references
                              |
                              +-> AgentRun published
                                    |
                                    v
                         harness opt-in e2e-runtime-16r
                                    |
                           encaminha o mesmo spec
                                    v
                           agno-bridge em modo stub
                                    |
                         resposta deterministica, sem provider
                                    |
                 callback unica com IDs/args ficticios limitados
                                    v
                         Orchestra runtime tool gateway
                           | policy + binding + allowlist
                           v
                        mcp-readonly-demo HTTP
                           | catalog.search/get_status
                           v
                metadata segura -> AgentRun/audit/Analytics
```

O harness existe somente em `runtime/e2e-fixtures/16r` e no override `docker-compose.e2e-16r.yml`. Ele nao e importado pelo backend nem pelo Agno bridge, nao aparece no compose produtivo e nao possui discovery. O spec completo e encaminhado ao Agno bridge sem log; a callback escolhe somente um descriptor ja governado e nao devolve o conteudo da tool ao backend como evidencia. O output do Agno continua deterministico, portanto `externalProviderCalled=false`; `simulated=false` refere-se ao transporte MCP real registrado pelo gateway.

## Pré-requisitos

- Docker Engine com Compose v2;
- Node.js 22 para os testes das fixtures e do MCP demo;
- banco local ja inicializado com as migrations versionadas e o seed de desenvolvimento previamente aplicado;
- portas locais `3000`, `5173`, `5432`, `8091` e `8092` livres;
- `DEV_LOGIN_ENABLED=true` somente no ambiente local;
- worktree limpa ou revisada antes da coleta de evidencia;
- nenhum arquivo `.env` ou valor de credencial deve ser anexado a ticket, log ou screenshot.

Valide primeiro, sem rede nem banco:

```bash
scripts/smoke-e2e-chat-rag-mcp-16r.sh --dry-run
scripts/homologacao-e2e-chat-rag-mcp-16r.sh --dry-run
npm --prefix runtime/e2e-fixtures/16r test
npm --prefix runtime/mcp-readonly-demo test
```

## Flags e envs necessárias

O override 16R ativa as flags apenas no perfil local. Defaults do repositorio e producao continuam fechados.

| Variavel | Valor 16R | Regra |
|---|---:|---|
| `RUNTIME_PROVIDER` | `agno_http` | backend usa o contrato HTTP |
| `RUNTIME_ALLOW_PROVIDER_FALLBACK` | `false` | nenhuma queda silenciosa |
| `AGNO_RUNTIME_HTTP_ENABLED` | `true` | runtime HTTP opt-in |
| `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED` | `true` | aceita somente contexto resolvido |
| `AGNO_RUNTIME_HTTP_TOOLS_ENABLED` | `true` | descriptors governados |
| `AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS` | `1` | limite desta fixture |
| `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS` | `1` | uma callback no maximo |
| `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED` | `true` | callback autenticada |
| `MCP_REMOTE_ENABLED` | `true` | gate mestre local |
| `MCP_REMOTE_DISCOVERY_ENABLED` | `true` | readiness/discovery local |
| `MCP_REMOTE_EXECUTION_ENABLED` | `true` | execucao controlada |
| `MCP_REMOTE_READONLY_ENABLED` | `true` | exige read-only |
| `MCP_REMOTE_EGRESS_ALLOWLIST` | `http://mcp-readonly-demo:8092` | origem exata |
| `MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO` | `true` | excecao HTTP proibida em producao |
| `MCP_REMOTE_LOCAL_DEMO_ORIGIN` | `http://mcp-readonly-demo:8092` | origem unica do demo |
| `MCP_REMOTE_ALLOW_WRITE_TOOLS` | `false` | invariante obrigatoria |

Uma credencial de transporte descartavel e exigida entre backend, harness e bridge. Gere-a na sessao local e nunca a exiba:

```bash
export AGNO_RUNTIME_HTTP_SECURITY_KEY="$(openssl rand -hex 24)"
```

O valor nao vai para Git, frontend, banco, audit ou output do script. Descarte-o ao final com `unset AGNO_RUNTIME_HTTP_SECURITY_KEY`.

## Como subir a stack local

O banco precisa estar previamente preparado; a 16R nao executa migration ou seed.

```bash
docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.agno-bridge.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  -f docker-compose.e2e-16r.yml \
  --profile mcp-demo \
  up --build -d
```

Confirme apenas estado/health, sem imprimir environments:

```bash
docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.agno-bridge.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  -f docker-compose.e2e-16r.yml \
  --profile mcp-demo ps
```

Servicos esperados: `backend`, `frontend`, `db`, `agno-bridge`, `e2e-runtime-16r` e `mcp-readonly-demo` saudaveis. Nao use `docker compose config` em evidencia, pois ele pode materializar valores injetados.

## Como subir MCP demo

Quando for necessario diagnosticar apenas o demo:

```bash
docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  --profile mcp-demo \
  up --build -d mcp-readonly-demo
```

O host publica somente `127.0.0.1:8092`; a rede Compose `mcp_demo_internal` e interna. O demo implementa `GET /health`, `GET /ready`, `GET /v1/catalog` e `POST /v1/tools/call`; o POST transporta somente consultas e rejeita qualquer nome fora das duas tools read-only.

## Readiness e discovery

O script valida health/ready do demo e chama os endpoints governados do backend sem imprimir responses:

```bash
scripts/homologacao-e2e-chat-rag-mcp-16r.sh --prepare
```

Antes da abertura da policy, `remote-readiness` deve permanecer bloqueado. Depois da abertura controlada, readiness deve ficar `ready` e discovery deve conter apenas `catalog.search` e `catalog.get_status`. Divergencia, redirect, host diferente, tool adicional ou status degradado bloqueia a homologacao.

## Preparar base RAG demo

`--prepare` usa dev-login local, cria ou reutiliza objetos com marker `fixturePhase=16R`, ingere `catalogo-ficticio.md`, habilita `allowRuntimeRetrieval` e cria o binding do assistant. Nomes exatos:

- assistant: `Orchestra 16R E2E Demo`;
- base: `Orchestra 16R Catalogo Ficticio`;
- documento: `Catalogo ficticio 16R`.

O estado tecnico e gravado com permissao privada em `/tmp/orchestra-e2e-16r-<uid>.state` por default. Ele contem apenas UUIDs e flags de ownership, nunca cookie ou credencial.

## Preparar assistant, policy, binding e tool

O mesmo `--prepare`:

1. cria/publica um assistant ficticio com `responseScopeMode=general_allowed`;
2. habilita execucao published e mantem os bloqueios de sandbox existentes;
3. cria Knowledge e MCP bindings idempotentes;
4. cria server remoto local, trusted/low-risk/auth none;
5. cria somente `catalog.search`, low-risk, sem approval e `metadata.readOnly=true`;
6. preserva policies MCP fechadas por default.

Tambem e possivel validar objetos ja aprovados, sem ownership de cleanup. Os IDs opcionais so sao aceitos quando apontam para as fixtures locais exatas: assistant com nome/marker 16R e server/tool com marker 16R, origem `http://mcp-readonly-demo:8092`, auth none, low-risk e read-only. Qualquer origem ou objeto diferente falha antes de criar bindings:

```bash
export ORCHESTRA_16R_ASSISTANT_ID='<uuid-do-assistant-local>'
export ORCHESTRA_16R_MCP_SERVER_ID='<uuid-do-server-demo-local>'
export ORCHESTRA_16R_MCP_TOOL_ID='<uuid-da-tool-readonly-local>'
scripts/homologacao-e2e-chat-rag-mcp-16r.sh --prepare
```

### Abertura local explícita da policy MCP

A API de catalogo cria policies fail-closed e nao possui endpoint publico para abri-las. A 16R nao contorna isso automaticamente. Em um banco exclusivamente local, um operador autorizado pode aplicar a transacao abaixo depois de revisar os UUIDs do state. Ela exige os markers 16R, origem exata, auth none, risk low e tool read-only; atualiza exatamente duas policies ou aborta; e registra dois audit logs sem payload.

Abra um `psql` dentro do container `db`, sem copiar variaveis de conexao:

```bash
docker compose -f docker-compose.dev.yml exec db \
  sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

No prompt, substitua somente os dois UUIDs lidos do state:

```sql
\set server_id '<uuid-do-server-16r>'
\set tool_id '<uuid-da-tool-16r>'

BEGIN;
SELECT set_config('orchestra.16r_server_id', :'server_id', true);
SELECT set_config('orchestra.16r_tool_id', :'tool_id', true);

DO $$
DECLARE
  changed_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM mcp_servers s
    JOIN mcp_tools t ON t.server_id = s.id
    WHERE s.id = current_setting('orchestra.16r_server_id')::uuid
      AND t.id = current_setting('orchestra.16r_tool_id')::uuid
      AND s.name = 'Orchestra MCP Read-only Demo 16R'
      AND s.base_url = 'http://mcp-readonly-demo:8092'
      AND s.status = 'active'
      AND s.trust_level = 'trusted'
      AND s.risk_level = 'low'
      AND s.auth_type = 'none'
      AND s.metadata ->> 'fixturePhase' = '16R'
      AND t.name = 'catalog.search'
      AND t.risk_level = 'low'
      AND t.requires_approval = false
      AND t.is_enabled = true
      AND t.metadata ->> 'fixturePhase' = '16R'
      AND (t.metadata ->> 'readOnly')::boolean = true
  ) THEN
    RAISE EXCEPTION 'fixture 16R exata nao encontrada; nenhuma policy foi aberta';
  END IF;

  UPDATE mcp_tool_policies
  SET allow_runtime_execution = true,
      sandbox_only = false,
      requires_approval = false,
      blocked_by_default = false,
      metadata = COALESCE(metadata, '{}'::jsonb) || '{"fixturePhase":"16R","localHomologation":true}'::jsonb,
      updated_at = now()
  WHERE mcp_server_id = current_setting('orchestra.16r_server_id')::uuid
    AND (mcp_tool_id IS NULL OR mcp_tool_id = current_setting('orchestra.16r_tool_id')::uuid);

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 2 THEN
    RAISE EXCEPTION 'esperadas 2 policies 16R; encontradas %', changed_count;
  END IF;

  INSERT INTO audit_logs (
    tenant_id, workspace_id, actor_user_id, action, entity, entity_id, metadata, created_at
  )
  SELECT
    p.tenant_id,
    p.workspace_id,
    s.created_by_id,
    'mcp_policy_updated',
    'mcp_tool_policy',
    p.id::text,
    jsonb_build_object(
      'fixturePhase', '16R',
      'mcpServerId', p.mcp_server_id,
      'mcpToolId', p.mcp_tool_id,
      'allowRuntimeExecution', true,
      'sandboxOnly', false,
      'blockedByDefault', false,
      'localHomologation', true
    ),
    now()
  FROM mcp_tool_policies p
  JOIN mcp_servers s ON s.id = p.mcp_server_id
  WHERE p.mcp_server_id = current_setting('orchestra.16r_server_id')::uuid
    AND (p.mcp_tool_id IS NULL OR p.mcp_tool_id = current_setting('orchestra.16r_tool_id')::uuid);
END $$;

COMMIT;
```

Esse passo e deliberadamente manual: torna visivel a mudanca de autoridade e evita que um script generico abra policy em ambiente errado.

## Executar AgentRun

Com a policy revisada e aberta:

```bash
scripts/homologacao-e2e-chat-rag-mcp-16r.sh --run
```

O harness envia o spec ao Agno bridge stub, que valida RAG/descriptors sem provider externo. Enquanto o run esta ativo, o harness solicita uma unica `catalog.search` ao gateway. O script tambem verifica o transporte HTTP do demo, mas nao usa essa chamada direta como evidencia do Caso A: o aceite vem exclusivamente do DTO do mesmo AgentRun.

## Validar RAG

Aceite:

- `ragIntentDetected=true`;
- `ragMode=resolved_context`;
- `ragSourceCount > 0`;
- `responseScopeMode=general_allowed`;
- `rawContentLogged=false`;
- `fallbackOutsideKnowledgeUsed=false` quando o resultado estiver resolvido.

O texto integral da pergunta, chunks e contexto enviados ao runtime nao devem entrar em logs/screenshot. O Analytics pode mostrar `input_summary`, titulo/label e excerpt truncado governado; isso nao autoriza exportar o conteudo.

## Validar MCP read-only real

No mesmo run:

- `externalMcpCalled=true`;
- `toolCallsExecuted=1`;
- `simulated=false`;
- `mcpRemoteEvaluationApplied=true`;
- `mcpRemoteAllowed=true`;
- `mcpRemoteBlocked=false`;
- `mcpRemoteReadOnly=true`;
- `mcpRemoteRiskLevel=low`;
- `responseBytes` dentro do limite;
- tool call persistida em `mode=remote_controlled`, sem previews.

`externalProviderCalled=false` e esperado nesta fixture, pois o Agno bridge opera em stub. A chamada MCP, entretanto, cruza gateway, client e transporte HTTP reais.

## Validar Analytics

1. Abra `http://127.0.0.1:5173/app/analytics`.
2. Filtre pelo assistant `Orchestra 16R E2E Demo` ou pelo `runId` informado no audit.
3. Abra o drawer do run.
4. Confirme as secoes `Response scope e RAG` e `Tools e uso`.
5. Confirme os campos de aceite acima e `externalProviderCalled=false`.
6. Interrompa a homologacao se aparecer prompt completo, contexto conversacional completo, request/response de provider, argumentos/output de tool, cabecalho de autenticacao, cookie, valor de credencial, `secretRef` ou configuracao privada de transporte.

## Validar audit e eventos

O comando recomendado imprime somente allowlist:

```bash
scripts/homologacao-e2e-chat-rag-mcp-16r.sh --audit
```

Ele consulta runtime detail, eventos do AgentRun e tool calls correlacionadas. Nao imprime response bodies, excerpts, `inputSummary`, messages, policy snapshots ou conteudo de tool.

Eventos esperados incluem retrieval resolvido, RAG attached, descriptors attached, tool completed e run completed. Audit logs esperados incluem criacao/atualizacao das fixtures, abertura manual da policy, request/start/completion do AgentRun e `runtime_tool_gateway_mcp_remote_readonly_executed`.

## Validar bloqueios e fail-closed

### Caso B — flag desligada

Recrie somente backend com a execucao remota desabilitada:

```bash
MCP_REMOTE_EXECUTION_ENABLED=false docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.agno-bridge.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  -f docker-compose.e2e-16r.yml \
  --profile mcp-demo \
  up -d --force-recreate backend
```

Execute `--run`; ele deve terminar com exit diferente de zero porque o Caso A nao foi aceito. Depois execute `--audit` e confirme `externalMcpCalled=false`, `mcpRemoteBlocked=true` e motivo sanitizado. O gateway bloqueia antes de criar o client/transporte.

### Caso B — allowlist vazia

```bash
MCP_REMOTE_EGRESS_ALLOWLIST= docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.agno-bridge.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  -f docker-compose.e2e-16r.yml \
  --profile mcp-demo \
  up -d --force-recreate backend
```

Repita `--run`/`--audit`. O esperado e `externalMcpCalled=false`, `mcpRemoteBlocked=true` e `mcpRemoteBlockedReason=egress_blocked`, sem args/output.

Restaure o perfil permitido recriando backend sem overrides adicionais.

### Caso C — write tool bloqueada

Nao cadastre uma write tool no banco. Use apenas a fixture de teste automatizado, que prova o bloqueio antes do client:

```bash
npm --prefix backend run test -- \
  tests/runtime/runtime-tool-gateway.test.ts \
  tests/unit/mcp-remote-client.test.ts \
  --run
```

Os testes usam nomes/metadata de escrita ficticios, esperam `dangerous_operation`, `externalMcpCalled=false`, client nao criado e nenhuma persistencia de args/output.

## Comandos SQL seguros

Use SQL somente leitura para evidencia. Substitua `run_id` pelo UUID do state; nao selecione `query_text`, `excerpt`, `input_summary`, previews ou metadata inteira.

```sql
\set run_id '<uuid-do-run-16r>'

SELECT
  id,
  status,
  mode,
  metadata #>> '{runtime,ragMode}' AS "ragMode",
  metadata #>> '{runtime,ragSourceCount}' AS "ragSourceCount",
  metadata #>> '{runtime,responseScopeMode}' AS "responseScopeMode",
  metadata #>> '{runtime,externalProviderCalled}' AS "externalProviderCalled",
  metadata #>> '{runtime,externalMcpCalled}' AS "externalMcpCalled",
  metadata #>> '{runtime,simulated}' AS "simulated",
  metadata #>> '{runtime,mcpRemoteAllowed}' AS "mcpRemoteAllowed",
  metadata #>> '{runtime,mcpRemoteBlocked}' AS "mcpRemoteBlocked",
  metadata #>> '{runtime,mcpRemoteBlockedReason}' AS "mcpRemoteBlockedReason",
  metadata #>> '{runtime,rawContentLogged}' AS "rawContentLogged"
FROM agent_runs
WHERE id = :'run_id'::uuid;

SELECT
  id,
  status,
  mode,
  risk_level_snapshot,
  input_preview IS NULL AS input_preview_absent,
  output_preview IS NULL AS output_preview_absent,
  metadata ->> 'externalMcpCalled' AS "externalMcpCalled",
  metadata ->> 'simulated' AS "simulated",
  metadata ->> 'mcpRemoteReadOnly' AS "mcpRemoteReadOnly"
FROM mcp_tool_calls
WHERE agent_run_id = :'run_id'::uuid;

SELECT status, mode, result_count, agent_run_id
FROM rag_queries
WHERE agent_run_id = :'run_id'::uuid;

SELECT action, entity, entity_id, created_at
FROM audit_logs
WHERE entity_id = :'run_id'
   OR metadata ->> 'runId' = :'run_id'
ORDER BY created_at;
```

Qualquer preview nao nulo, `rawContentLogged` diferente de `false` ou ausencia de correlacao bloqueia o aceite.

## Campos allowlistados

- IDs tecnicos: run, trace, request, assistant, version, policy, tool e binding;
- status, modo, timestamps, duracao e contadores;
- `ragMode`, `ragSourceCount`, `ragIntentDetected`, `ragSkippedReason`, `responseScopeMode`, `fallbackOutsideKnowledgeUsed`;
- `externalProviderCalled`, `externalMcpCalled`, `simulated`, `toolCallsExecuted`;
- `mcpRemoteEvaluationApplied`, `mcpRemoteAllowed`, `mcpRemoteBlocked`, `mcpRemoteBlockedReason`, `mcpRemoteReadOnly`, host sanitizado, risk level e response bytes;
- tokens/custo agregados e `rawContentLogged=false`;
- titulos/labels e excerpt RAG truncado apenas dentro da UI governada.

## Campos proibidos

- prompt ou mensagem completos fora do fluxo funcional;
- contexto conversacional, chunk, documento ou payload bruto;
- argumentos, input, output, result ou response brutos de tool;
- headers, cookies, Authorization, valor de credencial, API key, senha ou token;
- `secretRef`, URL privada completa, connection string ou environment dump;
- request/response bruto do provider ou do Agno bridge;
- screenshots de console contendo qualquer item acima.

## Critérios de aceite

1. todos os comandos obrigatorios de typecheck/test/build/smoke passam;
2. stack com seis servicos fica saudavel;
3. `--prepare` cria/reusa somente fixtures marcadas;
4. readiness RAG tem chunks/fontes e readiness MCP fica ready depois da aprovacao local;
5. Caso A passa no `--run` com RAG e MCP no mesmo AgentRun;
6. Analytics e `--audit` exibem somente os campos permitidos;
7. Caso B falha fechado para flag e allowlist;
8. Caso C bloqueia escrita antes do transporte;
9. schema/migrations permanecem inalterados;
10. nenhuma chamada externa, dado real, segredo real ou write tool e usada.

## Rollback e cleanup

Primeiro feche imediatamente as duas policies locais:

```sql
\set server_id '<uuid-do-server-16r>'

UPDATE mcp_tool_policies
SET allow_runtime_execution = false,
    sandbox_only = true,
    requires_approval = true,
    blocked_by_default = true,
    updated_at = now()
WHERE mcp_server_id = :'server_id'::uuid
  AND metadata ->> 'fixturePhase' = '16R';
```

Depois:

```bash
scripts/homologacao-e2e-chat-rag-mcp-16r.sh --cleanup

docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.agno-bridge.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  -f docker-compose.e2e-16r.yml \
  --profile mcp-demo \
  down

unset AGNO_RUNTIME_HTTP_SECURITY_KEY
```

`--cleanup` verifica marker e nome exatos antes de remover bindings/arquivar. Objetos fornecidos por IDs do operador nao sao arquivados; esses IDs ainda precisam representar as fixtures locais exatas descritas acima. Runs, tool calls e audit logs permanecem como evidencia imutavel. Nao use `down -v`, truncate, delete em massa ou reset de banco.

## Riscos remanescentes

- o harness prova integracao e governanca, mas o output LLM continua stub; qualidade de resposta exige evals;
- a abertura de policy e manual porque nao existe endpoint administrativo publico para essa mudanca de autoridade;
- uma unica flag `simulated` descreve o caminho MCP no aceite, enquanto eventos do modelo ainda identificam stub;
- a execucao do AgentRun e sincrona e o registry ativo do gateway e local ao processo;
- excerpts RAG truncados continuam sendo conteudo e devem permanecer na UI governada;
- nao ha E2E de navegador, load test, HA, TLS, secret manager ou conector corporativo nesta fase;
- o cleanup arquiva em vez de apagar e preserva evidencia historica por design.

## Próximos passos

A recomendacao para a Fase 16S e priorizar **Evals continuas e qualidade**: transformar a fixture 16R em casos de avaliacao versionados, acompanhar grounding, escolha de tool, recusas de escrita e regressao de metadata.

Somente depois deve ser considerada uma 16S/16T de primeiro conector corporativo read-only real, com threat model, classificacao de dados, owner, approval formal, secret manager, rotacao, rate limit, incident response e rollback aprovados. A homologacao 16R nao constitui autorizacao para esse conector.
