# Orchestra — Custos, quotas e rate limits no Runtime 16N

## Objetivo

A Fase 16N transforma a fundação consultiva de observabilidade em controle governado no caminho real do `AgentRun`. Policies ativas de `AiUsageLimitPolicy` são avaliadas antes de RAG, health-check do adapter, Agno bridge, provider ou tool gateway. A execução continua permitida quando não existe policy aplicável; `monitor_only` nunca bloqueia; somente uma violação de policy `enforce` bloqueia.

A implementação reutiliza `ai_usage_limit_policies`, `ai_run_usage_events`, `agent_runs`, `agent_run_events` e `audit_logs`. Não há migration, alteração do schema Prisma, tabela de preços ou estimativa hardcoded.

## Escopo

- avaliação de limites por tenant, workspace, assistant e user;
- aplicação dos filtros opcionais já existentes de source, operation, provider e model;
- projeção preflight conhecida de um novo `run_count`;
- uso do agregado persistido para tokens, custo, falhas e bloqueios, sem inventar projeções desconhecidas;
- bloqueio `enforce` antes de qualquer operação externa ou RAG adicional;
- persistência de metadata, `AgentRunEvent`, `AiRunUsageEvent` e audit allowlistados;
- propagação de custo normalizado do runtime apenas quando moeda e minor units formam um par confiável;
- extensão read-only da observabilidade 16M e de `/app/analytics`.

Ficam fora do escopo: pricing table, conversão cambial, reserva distribuída de quota, migration, MCP externo, execução real nova de tools e mudança da semântica Chat/RAG/response scope.

## Arquitetura de decisão

```text
autorização e precheck estrutural
              |
              v
AiUsageLimitsService.evaluate
  | policies ativas aplicáveis
  | janela UTC: minute/hour/day/month
  | agregado de ai_run_usage_events
  | projeção conhecida do novo run
              |
       +------+-------------------+
       |                          |
 sem policy / permitido       excedido
       |                    +-----+------+
       |                    |            |
       |               monitor_only    enforce
       |                    |            |
       v                    v            v
 metadata/event/audit    permite      bloqueia e persiste
       |                    |          sem RAG/runtime/provider/tool
       +----------+---------+
                  v
          fluxo Runtime Chat/RAG
                  |
                  v
     usage event com tokens/latência/custo confiável
```

O evaluator continua sendo a única fonte da semântica de janela, escopo, threshold e decisão. O `AgentRun` converte a decisão em uma projeção singular allowlistada, escolhendo primeiro uma decisão bloqueada, depois excedida, em warning e, por fim, a primeira aplicável. Isso evita persistir objetos amplos de policy.

## Momento da avaliação no AgentRun

A avaliação acontece depois de autenticação, RBAC e precheck estrutural do assistente, mas antes de:

- leitura/resolução adicional de contexto RAG;
- `runtimeService.health`;
- construção/ativação do tool gateway;
- `runtimeService.execute`;
- chamada HTTP ao Agno bridge ou provider;
- chamada MCP/tool.

Quando `enforce` bloqueia, o run é persistido diretamente como `blocked`, com `errorCode=AI_USAGE_LIMIT_EXCEEDED`, `blockedAt`, eventos seguros e sem `input_summary`. Metadata enviada pelo cliente não é incorporada ao run bloqueado.

Se o evaluator falhar tecnicamente, a execução segue em fail-open auditável com `usageLimitReason=evaluator_error`. O erro é auditado sem mensagem, query, stack ou payload. Esse comportamento impede que indisponibilidade da leitura de quota seja confundida com violação comprovada.

## `monitor_only` e `enforce`

| Situação | Execução | Registro |
| --- | --- | --- |
| nenhuma policy ativa aplicável | permitida | `not_applicable`, evento e audit de avaliação |
| `monitor_only` dentro do limite | permitida | avaliação allowlistada |
| `monitor_only` excedida | permitida | avaliação, `run.usage_limit_violation` e audit de monitoramento |
| `enforce` dentro do limite | permitida | avaliação com enforcement ativo e sem bloqueio |
| `enforce` excedida | bloqueada antes do runtime | run bloqueado, `run.usage_limit_blocked`, usage event bloqueado e audits |

`usageLimitEnforced=true` significa que ao menos uma policy aplicável estava em modo `enforce`; `usageLimitMode` descreve a decisão principal allowlistada e `usageLimitBlocked=true` identifica que uma violação efetivamente interrompeu a execução.

## Metadata e campos allowlistados

O resumo persistido em `agent_runs.metadata.runtime`, eventos, usage event e audits usa somente:

- `usageLimitEvaluationApplied`;
- `usageLimitMode` (`monitor_only`, `enforce` ou ausente);
- `usageLimitExceeded`;
- `usageLimitEnforced`;
- `usageLimitBlocked`;
- `usageLimitMetric`;
- `usageLimitScope`;
- `usageLimitPolicyId`;
- `usageLimitWindow` (`minute`, `hour`, `day` ou `month`);
- `usageLimitCurrentValue` como string decimal;
- `usageLimitThreshold` como string decimal;
- `usageLimitReason` (`not_applicable`, `within_limit`, `warning_threshold_reached`, `limit_exceeded` ou `evaluator_error`).

A observabilidade 16M também expõe `costCurrency` e `costMinorUnits` somente quando ambos foram persistidos no `AiRunUsageEvent`. Ausência ou par incompleto resulta em `null`/“Não informado”. Tokens e latência mantêm o comportamento anterior.

## Eventos e auditoria

Eventos de run:

- `run.usage_limit_evaluated` em toda execução que chega ao precheck de limite;
- `run.usage_limit_violation` para violação `monitor_only`;
- `run.usage_limit_blocked` para violação `enforce` bloqueada.

Actions de audit:

- `agent_run_usage_limit_evaluated`;
- `agent_run_usage_limit_monitor_violation`;
- `agent_run_usage_limit_blocked`;
- `agent_run_usage_limit_evaluator_failed`.

Os actions genéricos `runtime_execution_blocked` e `agent_run_blocked` também são registrados no bloqueio, sempre com a mesma metadata reduzida.

## Campos explicitamente proibidos

Não podem aparecer nos DTOs, eventos de limite, usage events ou audit logs:

- prompt, instruções ou input bruto;
- `input_summary` no bloqueio por limite;
- contexto conversacional ou contexto RAG bruto;
- query RAG bruta ou normalizada;
- conteúdo de documento/chunk;
- request/response ou payload bruto de provider;
- argumentos, outputs, schemas ou descritores brutos de tools;
- headers, cookies ou bearer tokens;
- API keys, passwords, credenciais, connection strings, secret refs ou secrets;
- stack trace ou mensagem bruta do evaluator/provider.

## Endpoints e UI

Os endpoints read-only permanecem:

- `GET /api/v1/ai-observability/runtime-runs`;
- `GET /api/v1/ai-observability/runtime-runs/:id`;
- `GET /api/v1/ai-observability/runtime-summary`.

`runtime-runs` aceita `usageLimitBlocked=true|false`. O filtro usa a relação com `agent_run_events.type`, que já possui índice; não foram adicionados filtros por mode ou metric sobre JSON sem índice. O summary conta `run.usage_limit_blocked` e `run.usage_limit_violation`. `/app/analytics` mostra os dois cards, badges de mode/bloqueio, detalhe da avaliação e custo somente com o par persistido.

Mocks continuam condicionados exclusivamente a `VITE_USE_MOCKS`; a fixture atualizada é identificada como demonstração e nunca substitui a API no modo real.

## Critérios de aceite

- sem policy aplicável, o run executa e registra `not_applicable`;
- `monitor_only` nunca bloqueia, inclusive quando excedida;
- `enforce` dentro do limite permite execução;
- `enforce` excedida bloqueia antes de RAG/runtime/provider/MCP/tool;
- bloqueio persiste status, erro controlado, evento, usage event e audit seguros;
- evaluator com erro não vaza detalhes e produz audit específico;
- custo normalizado é persistido somente com moeda e minor units confiáveis;
- DTOs e UI mostram custo apenas quando o par existe;
- os campos allowlistados aparecem nos endpoints 16M e nenhum campo proibido aparece;
- nenhum schema Prisma, migration, default de provider ou semântica Chat/RAG é alterado;
- smokes 16M, 16K e 16I continuam válidos.

## Consultas SQL para auditoria

Substitua os parâmetros e execute apenas em ambiente autorizado. As consultas não selecionam input, mensagens ou metadata ampla.

### Runs bloqueados por limite

```sql
SELECT
  ar.id AS run_id,
  ar.status,
  ar.error_code,
  ar.metadata #>> '{runtime,usageLimitMode}' AS usage_limit_mode,
  ar.metadata #>> '{runtime,usageLimitMetric}' AS usage_limit_metric,
  ar.metadata #>> '{runtime,usageLimitScope}' AS usage_limit_scope,
  ar.metadata #>> '{runtime,usageLimitCurrentValue}' AS current_value,
  ar.metadata #>> '{runtime,usageLimitThreshold}' AS threshold_value,
  ar.blocked_at
FROM agent_runs ar
WHERE ar.tenant_id = :tenant_id::uuid
  AND ar.workspace_id = :workspace_id::uuid
  AND EXISTS (
    SELECT 1
    FROM agent_run_events are
    WHERE are.agent_run_id = ar.id
      AND are.type = 'run.usage_limit_blocked'
  )
ORDER BY ar.created_at DESC
LIMIT 100;
```

### Violações `monitor_only`

```sql
SELECT
  are.agent_run_id,
  are.type,
  are.status,
  are.metadata ->> 'usageLimitMetric' AS usage_limit_metric,
  are.metadata ->> 'usageLimitScope' AS usage_limit_scope,
  are.metadata ->> 'usageLimitWindow' AS usage_limit_window,
  are.created_at
FROM agent_run_events are
WHERE are.tenant_id = :tenant_id::uuid
  AND are.workspace_id = :workspace_id::uuid
  AND are.type = 'run.usage_limit_violation'
ORDER BY are.created_at DESC
LIMIT 100;
```

### Usage e custo confiável

```sql
SELECT
  run_id,
  status,
  blocked_reason,
  provider,
  model,
  input_tokens,
  output_tokens,
  total_tokens,
  latency_ms,
  cost_currency,
  estimated_cost_minor_units,
  started_at
FROM ai_run_usage_events
WHERE tenant_id = :tenant_id::uuid
  AND workspace_id = :workspace_id::uuid
  AND source = 'runtime_adapter'
  AND operation = 'agent_run.runtime_execute'
ORDER BY started_at DESC
LIMIT 100;
```

### Audit allowlistado

```sql
SELECT
  action,
  entity_id AS run_id,
  metadata ->> 'usageLimitMode' AS usage_limit_mode,
  metadata ->> 'usageLimitMetric' AS usage_limit_metric,
  metadata ->> 'usageLimitReason' AS usage_limit_reason,
  request_id,
  created_at
FROM audit_logs
WHERE tenant_id = :tenant_id::uuid
  AND workspace_id = :workspace_id::uuid
  AND action IN (
    'agent_run_usage_limit_evaluated',
    'agent_run_usage_limit_monitor_violation',
    'agent_run_usage_limit_blocked',
    'agent_run_usage_limit_evaluator_failed'
  )
ORDER BY created_at DESC
LIMIT 100;
```

## Roteiro de teste manual

1. Em ambiente isolado, criar uma policy ativa `monitor_only` de `run_count` acima do consumo atual.
2. Executar um AgentRun e confirmar conclusão, evento de avaliação e badges na Analytics.
3. Ajustar o limite para produzir violação `monitor_only`; confirmar conclusão, `run.usage_limit_violation` e incremento do card.
4. Criar/alterar a policy para `enforce` ainda abaixo do limite; confirmar execução normal.
5. Produzir violação `enforce`; confirmar `blocked`, `AI_USAGE_LIMIT_EXCEEDED` e ausência de chamadas no Agno/provider/MCP/tool.
6. Conferir que o run bloqueado não possui `input_summary` e que eventos/audits contêm apenas a allowlist.
7. Exercitar o filtro “Bloqueado por limite” em `/app/analytics` e abrir o drawer.
8. Validar um usage event com custo completo e outro sem moeda/valor; somente o primeiro deve mostrar custo.
9. Inspecionar as respostas HTTP procurando os campos proibidos.
10. Executar typechecks, build, testes direcionados e todos os smokes documentados na entrega.

Não copiar prompts, inputs, contextos, payloads, headers ou credenciais para evidências do teste.

## Rollback

O rollback é somente de código:

1. remover a chamada ao evaluator e os helpers/eventos/audits 16N do `agent-runs.service.ts`;
2. restaurar mapper, repository e schema de observabilidade aos campos 16M;
3. restaurar service/page de Analytics sem indicadores de limite;
4. remover este runbook e o smoke 16N;
5. executar os typechecks, build, testes e smokes 16M/16K/16I.

Os registros 16N já persistidos podem permanecer: usam tabelas e colunas existentes e são metadata/eventos compatíveis. Não existe rollback de migration porque a fase não cria nem altera schema de banco.
