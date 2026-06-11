# Orchestra Agent Run Governance

Status: implementado na Fase 05E.

Este documento descreve a fronteira de execucao criada para `AgentRun`. A fase adiciona rastreabilidade, precheck obrigatorio, eventos persistidos e auditoria, mas ainda nao chama runtime real de IA, RAG, tools externas ou providers reais.

## Objetivo

`AgentRun` passa a ser o registro auditavel de uma tentativa de execucao de assistant.

Cada run possui:

- `runId` persistido em `agent_runs`.
- `traceId` para correlacao entre logs, eventos e auditoria.
- `requestId` do HTTP request.
- status controlado.
- modo solicitado.
- snapshot do precheck.
- eventos ordenados em `agent_run_events`.

O backend e a autoridade para criar, bloquear, listar e cancelar runs. O frontend apenas consome contratos e exibe estado.

## Status

Status suportados:

- `queued`: run solicitado.
- `prechecking`: precheck obrigatorio em andamento.
- `blocked`: precheck rejeitou a execucao.
- `running`: runtime boundary acionado.
- `completed`: fake runtime finalizou com sucesso.
- `failed`: reservado para falha de runtime.
- `cancelled`: cancelamento registrado.

Status terminais nesta fase:

- `blocked`
- `completed`
- `failed`
- `cancelled`

## Modos

Modos suportados:

- `draft_test`
- `sandbox`
- `published`
- `blocked`
- `archived`

`blocked` e `archived` nao sao modos executaveis. Quando solicitados no endpoint de run, o backend cria um run `blocked` para preservar rastreabilidade.

## Precheck Obrigatorio

O fluxo de criacao sempre executa precheck antes de acionar runtime boundary.

Regras avaliadas:

- assistant arquivado bloqueia execucao.
- modo `blocked` bloqueia execucao.
- modo `archived` bloqueia execucao.
- `draft_test` depende de `allowDraftTesting`.
- `sandbox` depende de sandbox habilitado, providers reais bloqueados, tools externas bloqueadas e logs obrigatorios.
- `published` depende de assistant publicado, publicacao ativa, `allowPublishedExecution`, `isExecutionEnabled` e ausencia de approvals pendentes de publish/enable execution.

Quando o precheck bloqueia:

- `AgentRun` e criado com status `blocked`.
- `precheckSnapshot` guarda `canExecute=false`, modo e reasons.
- `errorCode` e `errorMessage` recebem o primeiro motivo.
- eventos `run.precheck_failed` e `run.blocked` sao persistidos.
- audit log `agent_run_blocked` e registrado.

## Runtime Boundary

A fase usa somente `FakeRuntimeAdapter`.

O adapter:

- nao chama providers externos.
- nao chama tools externas.
- retorna eventos controlados.
- completa imediatamente runs aprovados.
- registra cancelamento de forma local quando o status permite.

Eventos gerados para run aprovado:

1. `run.requested`
2. `run.precheck_started`
3. `run.precheck_passed`
4. `run.started`
5. `run.mock_runtime_completed`
6. `run.completed`

Eventos gerados para run bloqueado:

1. `run.requested`
2. `run.precheck_started`
3. `run.precheck_failed`
4. `run.blocked`

## Permissoes

Permissoes adicionadas:

- `agent_runs.read`
- `agent_runs.create`
- `agent_runs.cancel`
- `agent_runs.audit`
- `execution.precheck`
- `execution.run_sandbox`
- `execution.run_published`

As rotas tambem validam workspace via escopo do usuario autenticado.

## Auditoria

Eventos de auditoria adicionados:

- `agent_run_requested`
- `agent_run_precheck_passed`
- `agent_run_blocked`
- `agent_run_started`
- `agent_run_completed`
- `agent_run_failed`
- `agent_run_cancelled`

Metadata de auditoria inclui ids tecnicos e codigos de governanca. O backend nao grava prompt completo, segredo, token, password, authorization, api key ou conteudo sensivel enviado em metadata.

## Logs

Logs estruturados incluem:

- `requestId`
- `traceId`
- `runId`
- `assistantId`
- `status`

Logs nao devem incluir entrada completa do usuario, prompt compilado, credentials ou tokens.

## Limites Atuais

- Runtime real de IA nao implementado.
- Streaming nao implementado.
- Workers e filas nao implementados.
- Cancelamento real de processo externo nao existe porque o adapter e fake.
- Costs, usage records e tool calls reais permanecem para fases futuras.
