# Orchestra Runtime Execution Data Model

Status: implementado na Fase 05E.

Este documento descreve a evolucao do modelo de dados para `AgentRun` e `AgentRunEvent`.

## Migration

Migration adicionada:

```txt
backend/prisma/migrations/20260611100000_phase05e_agent_run_governance/
```

Ela transforma o `agent_runs` reservado em uma entidade operacional de governanca e cria `agent_run_events`.

## agent_runs

Campos principais:

- `id`: UUID do run.
- `tenant_id`: tenant do run.
- `workspace_id`: workspace do run.
- `assistant_id`: assistant executado.
- `assistant_version_id`: versao selecionada no momento do run, quando disponivel.
- `assistant_publication_id`: publicacao usada em modo `published`, quando disponivel.
- `conversation_id`: reservado para integracao futura com chat.
- `requested_by_id`: usuario solicitante.
- `status`: estado do run.
- `mode`: modo solicitado.
- `source`: origem do request.
- `input_summary`: resumo sanitizado da entrada.
- `request_id`: request id HTTP.
- `trace_id`: id de correlacao.
- timestamps de lifecycle: `started_at`, `completed_at`, `failed_at`, `cancelled_at`, `blocked_at`.
- `error_code` e `error_message`.
- `precheck_snapshot`: JSON do resultado de governanca.
- `metadata`: JSON sanitizado.
- `created_at` e `updated_at`.

Indices:

- tenant
- workspace
- assistant
- assistant version
- assistant publication
- conversation
- requester
- status
- mode
- trace id
- created at

## agent_run_events

Eventos possuem timeline ordenada por run.

Campos:

- `id`
- `agent_run_id`
- `tenant_id`
- `workspace_id`
- `type`
- `sequence`
- `status`
- `message`
- `metadata`
- `created_at`

Restricao:

- `agent_run_id + sequence` e unico.

Isso garante ordem estavel para leitura REST e prepara a evolucao para streaming.

## Relacionamentos

`AgentRun` pertence a:

- `Tenant`
- `Workspace`
- `Assistant`
- `AssistantVersion` opcional
- `AssistantPublication` opcional
- `Conversation` opcional
- `User` como requester

`AgentRun` possui:

- muitos `AgentRunEvent`
- muitos `ToolCall`
- muitos `UsageRecord`

`ToolCall` e `UsageRecord` ja existiam como estrutura reservada. Nesta fase eles nao sao preenchidos por runtime real.

## Compatibilidade Com Modelo Reservado

O modelo anterior tinha `user_id`. A migration renomeia para `requested_by_id` e preenche tenant, workspace e trace id a partir dos relacionamentos existentes quando houver dados.

Ambientes locais de desenvolvimento podem aplicar `prisma migrate deploy` normalmente.

## Dados Sensíveis

O banco nao deve receber:

- prompt completo.
- entrada completa quando ela puder conter conteudo sensivel.
- secrets.
- tokens.
- passwords.
- headers de authorization.
- api keys.

O campo `input_summary` e resumido e `metadata` passa por sanitizacao antes de persistir.
