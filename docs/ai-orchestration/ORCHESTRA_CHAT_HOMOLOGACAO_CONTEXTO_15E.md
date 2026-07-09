# Orchestra Chat - Homologacao Funcional de Contexto Conversacional 15E

## Objetivo

A Fase 15E formaliza a homologacao funcional local do fluxo entregue nas Fases 15C e 15D: Chat persistente por conversa, mensagens persistidas, criacao de `AgentRun` a partir do Chat e envio de contexto conversacional governado ao runtime `agno_http`.

Esta fase nao adiciona feature produtiva. O objetivo e deixar a validacao local documentada, reproduzivel e limitada aos contratos ja entregues.

## Escopo Da Fase

Escopo validado:

- conversa persistente privada;
- mensagens de usuario e assistente persistidas;
- `AgentRun` criado pelo endpoint de conversa;
- provider `agno_http` selecionado pelo backend;
- runtime HTTP minimo Agno-compatible ativo;
- primeira mensagem sem historico anterior anexado;
- segunda mensagem com historico governado anexado;
- contexto no `AssistantRuntimeSpecV1` separado de `input.message`;
- eventos e metadados com informacoes quantitativas seguras;
- ausencia de chamada a provider externo;
- ausencia de chamada MCP externa;
- ausencia de execucao de tools.

## O Que Nao Foi Alterado

Esta fase nao altera:

- migrations;
- `schema.prisma`;
- fluxo de autenticacao, SSO, RBAC, permissoes ou roles;
- frontend produtivo;
- contrato de runtime;
- adapter `agno_http`;
- runtime HTTP minimo;
- fluxo de criacao de `AgentRun`;
- providers externos;
- MCP externo;
- execucao de tools.

## Ambiente Homologado

Branch de trabalho:

```txt
fase-15e-homologacao-chat-contexto-governado
```

Base esperada:

```txt
a3e8449 Merge branch 'fase-15d-contexto-conversacional-governado'
```

Componentes locais:

- Docker Compose com `frontend`, `backend` e `db`;
- backend em `http://localhost:3000`;
- frontend em `http://localhost:5173`;
- PostgreSQL/Prisma com migrations aplicadas;
- runtime HTTP minimo Agno-compatible em `http://127.0.0.1:8091`;
- provider de runtime do backend configurado como `agno_http`;
- runtime minimo em modo `sandbox`.

## Pre-Condicoes

Pre-condicoes para reproduzir a homologacao:

- Docker Compose ativo;
- containers `frontend`, `backend` e `db` em execucao;
- banco com migrations atualizadas;
- backend saudavel;
- frontend saudavel;
- runtime HTTP minimo iniciado;
- ambiente local sem credenciais reais exigidas para provider externo;
- Chat usando o endpoint backend de conversa.

## Comandos Operacionais

Os comandos abaixo usam `docker-compose.dev.yml`, que e o arquivo Compose local do repositorio. Se o ambiente ja expuser esse arquivo como default do Compose, o parametro `-f docker-compose.dev.yml` pode ser omitido.

Verificar containers:

```bash
docker compose -f docker-compose.dev.yml ps
```

Validar backend:

```bash
curl -fsS http://localhost:3000/health | python3 -m json.tool
curl -fsS http://localhost:3000/health/db | python3 -m json.tool
```

Validar frontend:

```bash
curl -fsS http://localhost:5173/health.html
```

Verificar migrations:

```bash
docker compose -f docker-compose.dev.yml exec -T backend sh -lc 'npx prisma migrate status --schema prisma/schema.prisma'
```

Aplicar migrations pendentes, quando o status indicar pendencia:

```bash
docker compose -f docker-compose.dev.yml exec backend sh -lc 'npx prisma migrate deploy --schema prisma/schema.prisma'
docker compose -f docker-compose.dev.yml restart backend
```

Na homologacao manual, o banco inicialmente nao tinha a migration da 15C aplicada. O erro observado foi:

```txt
The column `conversations.tenant_id` does not exist in the current database.
```

A correcao local aplicada foi:

```bash
docker compose exec backend sh -lc 'npx prisma migrate deploy --schema prisma/schema.prisma'
docker compose restart backend
```

Depois da correcao, o status observado foi:

```txt
20 migrations found
Database schema is up to date!
```

Iniciar o runtime HTTP minimo:

```bash
docker compose -f docker-compose.dev.yml exec -d backend sh -lc 'npm run agno:runtime > /tmp/agno-runtime.log 2>&1'
```

Validar `/health` do runtime minimo:

```bash
curl -fsS http://127.0.0.1:8091/health | python3 -m json.tool
```

Resultado esperado:

```json
{
  "provider": "agno",
  "protocolVersion": "orchestra.runtime.assistant.v1",
  "status": "healthy",
  "message": "Agno-compatible runtime contract service is healthy.",
  "details": {
    "mode": "sandbox",
    "externalProvidersCalled": false,
    "databaseCalled": false
  }
}
```

Validar `/capabilities` do runtime minimo:

```bash
curl -fsS http://127.0.0.1:8091/capabilities | python3 -m json.tool
```

Resultado esperado:

```json
{
  "provider": "agno",
  "protocolVersion": "orchestra.runtime.assistant.v1",
  "supportsStreaming": false,
  "supportsTools": false,
  "supportsRagContext": true,
  "supportsFileInputs": false,
  "maxInputChars": 16000,
  "maxToolCalls": 0
}
```

## Assistente Homologado

Assistente usado na homologacao local:

```txt
8222eea4-596e-46a0-bfbd-8551cc58abd7
```

## Teste 1 - Primeira Mensagem

Entrada:

```txt
oi chat
```

Run observado:

```txt
runId: 493d278c-e5e0-4b28-8f3e-137cc0320d52
traceId: trace_899b225e-3749-4226-a887-f6c521268eaa
requestId: req_7ae088e7-8f92-4e66-ab5e-8b3c98cfcdc2
status: completed
mode: published
source: chat-conversation
runtime provider: agno_http
externalProviderCalled: false
externalMcpCalled: false
toolCallsExecuted: 0
```

Resultado esperado:

- `AgentRun` criado com `source = chat-conversation`;
- runtime provider `agno_http`;
- mensagem atual mantida como `input`;
- contexto conversacional avaliado pelo backend;
- nenhum historico anterior relevante anexado;
- nenhuma chamada externa a provider;
- nenhuma chamada externa a MCP;
- nenhuma tool executada.

Eventos esperados:

```txt
run.requested
run.precheck_started
run.conversation_context_selected
run.precheck_passed
runtime.provider_selected
agno.request_started
agno.request_completed
runtime.run_started
runtime.model_started
runtime.model_completed
runtime.run_completed
runtime.run_completed
```

Interpretacao:

A primeira mensagem avalia o mecanismo de contexto conversacional, mas nao deve anexar historico anterior porque a conversa ainda nao possui mensagens anteriores relevantes para o runtime.

## Teste 2 - Segunda Mensagem

Entrada enviada na mesma conversa:

```txt
você lembra o que eu acabei de dizer?
```

Run observado:

```txt
runId: 1bb186b6-ed07-4b14-8e8b-cadb4e10f260
traceId: trace_5d230b7a-3aea-4fcb-b1c0-49e61a4ab1b4
requestId: req_b19545aa-db1b-42cc-bfd9-8bb5c762bb52
status: completed
mode: published
source: chat-conversation
runtime provider: agno_http
externalProviderCalled: false
externalMcpCalled: false
toolCallsExecuted: 0
```

Resultado esperado:

- `AgentRun` criado com `source = chat-conversation`;
- `input.message` contendo somente a segunda mensagem;
- historico anterior anexado em `conversationContext` no `AssistantRuntimeSpecV1`;
- resumo quantitativo do contexto persistido em metadata segura;
- evento `runtime.llm_context_attached` presente;
- nenhuma chamada externa a provider;
- nenhuma chamada externa a MCP;
- nenhuma tool executada.

Evento relevante:

```txt
runtime.llm_context_attached
Contexto conversacional governado anexado a AssistantRuntimeSpecV1.
```

Eventos esperados:

```txt
run.requested
run.precheck_started
run.conversation_context_selected
run.precheck_passed
runtime.provider_selected
runtime.llm_context_attached
agno.request_started
agno.request_completed
runtime.run_started
runtime.model_started
runtime.model_completed
runtime.run_completed
runtime.run_completed
```

Interpretacao:

A segunda mensagem confirma que o Chat persistente da 15C fornece mensagens anteriores para o seletor governado da 15D. O backend envia esse recorte ao runtime em campo separado, sem concatenar historico no `input` atual.

## Consultas SQL De Validacao

Listar eventos do run:

```sql
select
  sequence,
  type,
  status,
  message,
  metadata
from agent_run_events
where agent_run_id = '1bb186b6-ed07-4b14-8e8b-cadb4e10f260'
order by sequence asc;
```

Validar o evento de contexto anexado:

```sql
select
  agent_run_id,
  sequence,
  type,
  status,
  (metadata->>'conversationContextIncluded')::boolean as context_included,
  (metadata->>'conversationContextMessageCount')::int as context_message_count,
  (metadata->>'conversationContextChars')::int as context_chars,
  (metadata->>'conversationContextTruncated')::boolean as context_truncated
from agent_run_events
where agent_run_id = '1bb186b6-ed07-4b14-8e8b-cadb4e10f260'
  and type = 'runtime.llm_context_attached';
```

Validar o resumo no evento `runtime.run_completed`:

```sql
select
  agent_run_id,
  sequence,
  type,
  status,
  (metadata->>'conversationContextIncluded')::boolean as context_included,
  (metadata->>'conversationContextMessageCount')::int as context_message_count,
  (metadata->>'conversationContextChars')::int as context_chars,
  (metadata->>'conversationContextTruncated')::boolean as context_truncated
from agent_run_events
where agent_run_id = '1bb186b6-ed07-4b14-8e8b-cadb4e10f260'
  and type = 'runtime.run_completed'
order by sequence asc;
```

Validar `agent_runs`:

```sql
select
  id,
  status,
  source,
  error_code,
  metadata->'conversationContextSummary' as conversation_context_summary,
  (metadata#>>'{conversationContextSummary,included}')::boolean as conversation_context_included,
  (metadata#>>'{conversationContextSummary,messageCount}')::int as conversation_context_message_count,
  (metadata#>>'{conversationContextSummary,totalChars}')::int as conversation_context_total_chars,
  (metadata#>>'{conversationContextSummary,truncated}')::boolean as conversation_context_truncated,
  (metadata#>>'{runtime,conversationContextIncluded}')::boolean as runtime_context_included,
  (metadata#>>'{runtime,conversationContextMessageCount}')::int as runtime_context_message_count,
  (metadata#>>'{runtime,conversationContextChars}')::int as runtime_context_chars,
  (metadata#>>'{runtime,conversationContextTruncated}')::boolean as runtime_context_truncated
from agent_runs
where id = '1bb186b6-ed07-4b14-8e8b-cadb4e10f260';
```

## Resultado Validado

Resultado direto observado para a segunda mensagem:

```txt
agent_run_id: 1bb186b6-ed07-4b14-8e8b-cadb4e10f260
sequence: 13
type: runtime.run_completed
status: completed
context_included: true
context_message_count: 2
context_chars: 95
context_truncated: false
```

Resumo persistido em `agent_runs.metadata.conversationContextSummary`:

```json
{
  "enabled": true,
  "included": true,
  "truncated": false,
  "totalChars": 95,
  "maxMessages": 12,
  "messageCount": 2,
  "maxTotalChars": 6000,
  "maxMessageChars": 1200
}
```

Campos confirmados:

- `conversationContextSummary.included = true`;
- `conversationContextSummary.messageCount = 2`;
- `conversationContextSummary.totalChars = 95`;
- `conversationContextSummary.truncated = false`;
- `runtime_context_included = true`;
- `runtime_context_message_count = 2`;
- `runtime_context_chars = 95`;
- `runtime_context_truncated = false`.

## Criterios De Aceite

A homologacao e aceita quando:

- as migrations estao atualizadas;
- backend e frontend estao saudaveis;
- runtime HTTP minimo responde `/health` como `healthy`;
- runtime HTTP minimo responde `/capabilities` com `supportsTools = false` e `maxToolCalls = 0`;
- a primeira mensagem cria `AgentRun` concluido sem historico anterior anexado;
- a segunda mensagem cria `AgentRun` concluido com contexto conversacional governado;
- `runtime.llm_context_attached` aparece somente quando ha contexto enviado;
- `AssistantRuntimeSpecV1.input.message` permanece separado do historico;
- eventos e metadata registram apenas contadores, flags e limites;
- `externalProviderCalled = false`;
- `externalMcpCalled = false`;
- `toolCallsExecuted = 0`;
- nao ha segredo, header de autorizacao, cookie, connection string real ou payload sensivel na evidencia.

## Riscos E Observacoes

- O runtime minimo homologado e sandbox.
- O runtime minimo nao e AgentOS/Agno completo.
- O fluxo nao chama provider externo.
- O fluxo nao chama MCP externo.
- O fluxo nao executa tools.
- A redacao de conteudo sensivel e basica; DLP/classificacao ficam para fase futura.
- Conversas longas ainda dependem de sumarizacao governada ou memoria longa separada.

## Proximas Fases Naturais

- provider externo real governado;
- politica por assistente para contexto;
- melhoria da UI para exibir contadores de contexto;
- DLP/classificacao antes do runtime;
- sumarizacao governada para conversas longas;
- memoria longa governada separada de historico bruto.
