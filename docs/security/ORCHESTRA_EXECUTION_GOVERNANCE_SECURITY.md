# Orchestra Execution Governance Security

Status: implementado na Fase 05E para runtime boundary fake.

Este documento descreve controles de seguranca aplicados a `AgentRun`.

## Principios

- Backend e autoridade de autorizacao.
- Precheck e obrigatorio antes de runtime boundary.
- Run bloqueado tambem deve ser persistido.
- Logs e auditoria usam ids tecnicos, nao payload sensivel.
- Runtime real, providers externos e tools externas continuam fora do escopo.

## Autorizacao

Permissoes novas:

- `agent_runs.read`
- `agent_runs.create`
- `agent_runs.cancel`
- `agent_runs.audit`
- `execution.precheck`
- `execution.run_sandbox`
- `execution.run_published`

As rotas exigem sessao valida e permissao. O service tambem valida workspace e policies especificas.

## Bloqueios de Governanca

O precheck bloqueia execucao quando:

- assistant esta arquivado.
- modo solicitado e `blocked` ou `archived`.
- draft testing esta desabilitado.
- sandbox esta desabilitado ou nao bloqueia providers/tools externos.
- sandbox nao exige logs.
- published execution nao esta liberada.
- assistant nao esta publicado.
- nao existe publicacao ativa.
- existem approvals pendentes de publicacao ou habilitacao de execucao.

Bloqueios sao resposta de dominio, nao falha de transporte. Por isso o endpoint cria `AgentRun` com `status=blocked` e retorna `201`.

## Sanitizacao

Metadata de run passa por sanitizacao recursiva limitada.

Chaves redigidas:

- `instructions`
- `prompt`
- `content`
- `secret`
- `token`
- `password`
- `apiKey`
- `authorization`

Strings sao truncadas para reduzir vazamento acidental. O backend armazena `inputSummary`, nao a entrada completa.

## Auditoria

Eventos gerados:

- `agent_run_requested`
- `agent_run_precheck_passed`
- `agent_run_blocked`
- `agent_run_started`
- `agent_run_completed`
- `agent_run_failed`
- `agent_run_cancelled`

Eventos de permissao negada continuam como `permission_denied`.

## Observabilidade Segura

Logs estruturados podem incluir:

- `requestId`
- `traceId`
- `runId`
- `assistantId`
- `status`

Logs nao devem incluir:

- prompt.
- entrada completa.
- credentials.
- cookies.
- tokens.
- headers de authorization.

## Cancelamento

Cancelamento e aceito apenas para:

- `queued`
- `prechecking`
- `running`

Runs terminais retornam `409 RUN_NOT_CANCELLABLE`.

Como o adapter atual e fake e completa imediatamente, a maioria dos runs criados pela UI ficara terminal logo apos a criacao.

## Limites

- Nao ha isolamento de processo de runtime porque runtime real nao existe.
- Nao ha revogacao de chamada externa em andamento.
- Nao ha streaming de eventos.
- Nao ha calculo real de custo ou tokens.
