# Orchestra Observabilidade - Limites e Quotas 12B

## 1. Objetivo

A Fase 12B cria a fundacao backend para definir e avaliar limites de uso de IA no Orchestra. Ela usa os eventos de `AiRunUsageEvent`, criados na 12A, como fonte de verdade para contadores, tokens, falhas, bloqueios e custo estimado.

A entrega e deliberadamente isolada: adiciona model, migration, repository read-only, evaluator e testes, sem endpoint, dashboard, alerta ou enforcement conectado ao runtime produtivo.

## 2. Modelo de politica

O model `AiUsageLimitPolicy`, mapeado para `ai_usage_limit_policies`, armazena:

- escopo: `tenantId`, `workspaceId`, `assistantId`, `userId` e `scopeType`;
- regra: `metric`, `period`, `mode`, `status`, `limitValue` e `warnThresholdValue`;
- filtros opcionais: `source`, `operation`, `provider` e `model`;
- governanca: descricao, metadata sanitizada, autores de criacao/atualizacao e timestamps;
- soft delete por `deletedAt`.

A migration `20260629180000_phase_12b_ai_usage_limit_policies` cria a tabela, FKs, indices e CHECK constraints. As constraints fecham todas as allowlists, exigem `limitValue > 0`, limitam o warning ao intervalo entre zero e o limite e garantem coerencia entre `scopeType` e o ID alvo. Nao existe backfill nem alteracao de dados anteriores.

## 3. Escopos e matching

Uma politica so e aplicavel quando pertence ao mesmo tenant, esta ativa, nao foi removida por soft delete e atende ao escopo:

- `tenant`: cobre todos os eventos do tenant;
- `workspace`: exige o mesmo `workspaceId`;
- `assistant`: exige o mesmo `assistantId`;
- `user`: exige o mesmo `userId`.

Filtros opcionais de source, operation, provider e model funcionam como refinamentos exatos. Quando a policy define um filtro, o contexto de avaliacao precisa fornecer o mesmo valor. O repository faz esse matching no Prisma e o service repete a validacao defensivamente.

## 4. Metricas suportadas

As politicas podem limitar:

- `run_count`: quantidade de `runId` distintos;
- `total_tokens`;
- `input_tokens`;
- `output_tokens`;
- `embedding_tokens`;
- `cached_tokens`;
- `estimated_cost_minor_units`;
- `failed_run_count`: `runId` distintos com status `failed`;
- `blocked_run_count`: `runId` distintos com status `blocked`.

As somas leem exclusivamente `ai_run_usage_events`. Valores nulos contribuem com zero. A consulta SQL converte o agregado para texto e o repository o transforma diretamente em `bigint`, sem passagem por float ou por `number` inseguro.

## 5. Periodos UTC

O evaluator calcula janelas deterministicas e semiabertas, `[inicio, fim)`, usando `startedAt`:

- `minute`: inicio do minuto UTC atual;
- `hour`: inicio da hora UTC atual;
- `day`: 00:00 UTC do dia atual;
- `month`: 00:00 UTC do primeiro dia do mes atual.

Timezone por tenant fica para uma fase posterior.

## 6. Avaliacao

A API interna de codigo e `evaluateAiUsageLimits(input)`.

Para cada policy aplicavel, o evaluator:

1. calcula a janela UTC;
2. agrega o valor atual em `AiRunUsageEvent`;
3. normaliza a projecao como `bigint`;
4. avalia `currentValue + projectedValue`;
5. retorna limite, threshold, uso atual, projecao, saldo, flags e motivo.

Quando `projectedUsage` e omitido, `run_count` assume um run de preflight e as demais metricas assumem zero. Para consultar somente o estado atual, o chamador pode enviar `projectedUsage: { runCount: 0 }`. `total_tokens` usa o valor explicito ou deriva input mais output.

Sem policies aplicaveis, o resultado e `allowed: true`.

## 7. Monitoramento e enforcement

- `monitor_only`: nunca bloqueia. Ao atingir o warning ou exceder o limite, retorna status `warn`.
- `enforce`: retorna `blocked` quando o valor avaliado e maior que o limite. O valor exatamente igual ao limite continua permitido.
- `warnThresholdValue`: gera `warn` quando o valor avaliado atinge ou supera o threshold, antes do bloqueio.

Esse bloqueio existe somente no resultado read-only do evaluator. A 12B nao liga a decisao a endpoint ou runtime produtivo.

## 8. Custo sem float

`limitValue`, `warnThresholdValue`, uso atual, projecao e saldo usam `BigInt`/`bigint`.

A metrica `estimated_cost_minor_units` soma apenas o custo estimado ja registrado pela 12A. A 12B nao calcula pricing, nao consulta provider, nao converte moeda, nao cobra e nao implementa billing. Pricing governado e custo real ficam para fase posterior.

## 9. Seguranca e metadata

A policy possui `metadata`, mas esta fase nao cria operacao de escrita para policies. Qualquer create/update futuro deve aplicar `sanitizeAiUsageMetadata` antes do repository.

A sanitizacao defensiva da 12A remove prompt, response, raw documents, headers, Authorization, cookies, token, apiKey, password, secret, credential, secretRef, baseUrl, connection string e payload bruto. O evaluator trabalha somente com IDs tecnicos, timestamps e valores agregaveis.

Nao ha fetch, chamada externa, provider LLM, scraping, MCP remoto ou Agno/AgentOS no fluxo de avaliacao.

## 10. Fora do escopo

Permanecem fora da 12B:

- dashboard e frontend;
- endpoints publicos ou administrativos;
- alertas e notificacoes;
- billing, invoice, pagamento e export financeiro;
- avaliacao automatica de qualidade e test sets;
- workers, filas e schedules;
- enforcement automatico em runtime;
- execucao MCP remota e materializacao em `McpTool`;
- integracao Agno/AgentOS produtiva;
- mudancas em Auth, SSO, RBAC, RAG ou Runtime Adapter.

## 11. Testes

Os testes unitarios cobrem ausencia de policies, escopos, tenant isolation, filtros opcionais, janelas UTC, todas as metricas, warnings, monitoramento, enforcement, soft delete, custo bigint, sanitizacao e ausencia de chamadas externas.

O teste estrutural cobre allowlists e constraints SQL, FKs, indices, uso exclusivo de `ai_run_usage_events`, agregacao bigint-safe e ausencia de SQL destrutivo ou modelos operacionais fora de escopo.

## 12. Riscos e proximos passos

Riscos remanescentes:

- ainda nao existe CRUD governado para policies;
- o evaluator faz uma agregacao por policy, sem materializacao ou cache para alto volume;
- timezone e calendario por tenant ainda nao existem;
- eventos 12A ainda dependem de instrumentacao futura dos fluxos oficiais;
- nao existe tabela de pricing governada;
- a migration ainda precisa ser aplicada no ambiente alvo.

Proximos passos previstos:

- 12C: dashboard e API admin read-only de observabilidade;
- 12D: alertas;
- 13A: avaliacao simples e test sets.
