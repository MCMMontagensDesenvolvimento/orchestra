# Orchestra Chat/RAG — Homologacao Operacional 16K

## Objetivo

A Fase 16K cria uma camada repetivel de homologacao e evidencias governadas para o runtime Chat/Agno/RAG. Ela nao altera a semantica do runtime, nao cria migration e nao habilita providers, MCP externo ou retrieval fora dos controles ja existentes.

O aceite combina verificacao estatica, testes automatizados e consultas SQL somente leitura. A evidencia deve demonstrar o modo de resposta, a decisao de intencao RAG, o resultado do retrieval e os contadores operacionais sem copiar prompt bruto, conteudo bruto, headers, tokens, credenciais ou API keys.

## Invariantes homologados

- `responseScopeMode`: `knowledge_only`, `knowledge_first` ou `general_allowed`.
- `ragIntentDetected` e `ragSkippedReason`: decisao e motivo governados do detector de intencao.
- `fallbackOutsideKnowledgeUsed`: verdadeiro apenas quando o modo permite e efetivamente precisa sinalizar fallback fora da base.
- `rawContentLogged=false`: prompts e conteudo bruto nao fazem parte da metadata operacional.
- `runtime.rag_context_attached`: evento emitido quando existe contexto RAG resolvido e anexado.
- `hybrid_stub_keyword_priority`: modo hybrid offline em que o stub semantico nao supera a prioridade lexical.
- `non_general_query_with_knowledge_bindings`, `response_scope_question` e `general_question_no_knowledge_signal`: razoes auditaveis da classificacao de intencao.

## Matriz minima automatizada

| `responseScopeMode` | Pergunta | Retrieval esperado | Evidencia minima |
| --- | --- | --- | --- |
| `knowledge_first` | da base | RAG `resolved_context` | `ragIntentDetected=true`, fonte selecionada e `fallbackOutsideKnowledgeUsed=false` |
| `knowledge_first` | geral sobre estados do Brasil | sem RAG | `ragSkippedReason=general_question_no_knowledge_signal` e `fallbackOutsideKnowledgeUsed=true` |
| `knowledge_first` | pergunta se pode sair da base | sem RAG | `ragSkippedReason=response_scope_question` e `fallbackOutsideKnowledgeUsed=true` |
| `knowledge_only` | geral sobre estados do Brasil | tentativa governada, sem contexto resolvido quando nao ha resultado | instrucoes limitadas a base e `fallbackOutsideKnowledgeUsed=false` |
| `knowledge_only` | pergunta se pode sair da base | sem RAG | instrucoes limitadas a base, `ragSkippedReason=response_scope_question` |
| `general_allowed` | geral sobre estados do Brasil | sem RAG | `ragSkippedReason=general_question_no_knowledge_signal` e `fallbackOutsideKnowledgeUsed=false` |
| `general_allowed` | `me fale sobre troca de notebook` | RAG `resolved_context` | `ragIntentDetected=true` e evento `runtime.rag_context_attached` |
| `general_allowed` | referencia explicita ao FAQ | RAG `resolved_context` | `ragIntentDetected=true`, fonte governada selecionada |

Os cenarios residem em `backend/tests/api/agent-runs.test.ts`. O builder do contrato Agno e seus limites continuam cobertos por `backend/tests/unit/runtime-assistant-spec-builder.test.ts`.

## Execucao da homologacao

Na raiz do repositorio:

```bash
git diff --check
npm --prefix backend run typecheck
npm --prefix backend run test -- tests/api/agent-runs.test.ts tests/unit/runtime-assistant-spec-builder.test.ts --run
npm --prefix frontend run typecheck
scripts/smoke-chat-rag-operacional-16k.sh --dry-run
scripts/smoke-knowledge-rag-16i.sh --dry-run
```

O smoke 16K apenas le arquivos versionados. Ele nao carrega `.env`, nao chama rede, nao consulta banco, nao inicia containers e nao imprime prompts ou excerpts.

## Evidencia operacional governada

Antes de consultar um ambiente:

1. use acesso somente leitura e filtre por `tenant_id`, `workspace_id` e janela curta;
2. use dados sinteticos na homologacao;
3. limite o resultado e mantenha a evidencia no repositorio aprovado para auditoria;
4. em screenshots ou tickets, retenha somente IDs, timestamps, status, modos, razoes e contadores;
5. nao exporte `query_text`, `input_summary` ou `excerpt`; esses campos aparecem nas consultas para investigacao restrita e devem ser redigidos de qualquer evidencia compartilhada.

### Auditoria de `agent_runs` recentes

Substitua os UUIDs pelos identificadores autorizados do ambiente e ajuste a janela se necessario. `input_summary` e um resumo persistido, mas ainda deve ser tratado como dado potencialmente sensivel.

```sql
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    '00000000-0000-0000-0000-000000000000'::uuid AS workspace_id,
    now() - interval '24 hours' AS since
)
SELECT
  ar.created_at,
  ar.id AS agent_run_id,
  ar.status,
  ar.metadata #>> '{runtime,ragMode}' AS "ragMode",
  COALESCE((ar.metadata #>> '{runtime,ragSourceCount}')::integer, 0) AS "ragSourceCount",
  ar.metadata #>> '{runtime,responseScopeMode}' AS "responseScopeMode",
  (ar.metadata #>> '{runtime,ragIntentDetected}')::boolean AS "ragIntentDetected",
  ar.metadata #>> '{runtime,ragSkippedReason}' AS "ragSkippedReason",
  (ar.metadata #>> '{runtime,fallbackOutsideKnowledgeUsed}')::boolean AS "fallbackOutsideKnowledgeUsed",
  COALESCE((ar.metadata #>> '{runtime,rawContentLogged}')::boolean, false) AS "rawContentLogged",
  ar.input_summary
FROM agent_runs ar
JOIN params p
  ON p.tenant_id = ar.tenant_id
 AND p.workspace_id = ar.workspace_id
WHERE ar.created_at >= p.since
ORDER BY ar.created_at DESC
LIMIT 100;
```

Leitura esperada:

- run com RAG resolvido: `ragMode=resolved_context` e `ragSourceCount > 0`;
- run sem RAG: `ragSourceCount=0`, com a decisao explicada por `ragSkippedReason` quando aplicavel;
- qualquer linha com `rawContentLogged` diferente de `false` bloqueia a homologacao e exige investigacao antes de nova execucao.

### Auditoria de `rag_queries` e `rag_query_results`

A consulta abaixo trunca e normaliza o excerpt para investigacao em console. Mesmo truncado, ele continua sendo conteudo da base: nao o copie para logs, tickets ou screenshots.

```sql
WITH params AS (
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS tenant_id,
    '00000000-0000-0000-0000-000000000000'::uuid AS workspace_id,
    now() - interval '24 hours' AS since
)
SELECT
  rq.created_at,
  rq.id AS rag_query_id,
  rq.agent_run_id,
  rq.query_text,
  rq.metadata ->> 'retrievalMode' AS "retrievalMode",
  COALESCE((rq.metadata ->> 'keywordUsed')::boolean, false) AS "keywordUsed",
  COALESCE((rq.metadata ->> 'semanticUsed')::boolean, false) AS "semanticUsed",
  COALESCE((rq.metadata ->> 'hybridMergeApplied')::boolean, false) AS "hybridMergeApplied",
  COALESCE((rq.metadata ->> 'stubKeywordPriority')::boolean, false) AS "stubKeywordPriority",
  rqr.rank,
  kd.title AS document_title,
  ksr.label AS source_label,
  left(regexp_replace(rqr.excerpt, E'[\\n\\r\\t]+', ' ', 'g'), 240) AS excerpt_truncado
FROM rag_queries rq
JOIN params p
  ON p.tenant_id = rq.tenant_id
 AND p.workspace_id = rq.workspace_id
LEFT JOIN rag_query_results rqr
  ON rqr.rag_query_id = rq.id
LEFT JOIN knowledge_documents kd
  ON kd.id = rqr.document_id
LEFT JOIN knowledge_source_references ksr
  ON ksr.id = rqr.source_reference_id
WHERE rq.created_at >= p.since
ORDER BY rq.created_at DESC, rqr.rank ASC NULLS LAST
LIMIT 200;
```

Para `hybrid_stub_keyword_priority`, a evidencia esperada e `keywordUsed=true`, `semanticUsed=true`, `hybridMergeApplied=true` e `stubKeywordPriority=true`. Resultados devem aparecer em ordem crescente de `rank`, com `document_title` e `source_label` coerentes com a fonte governada.

## Criterios de aceite e bloqueio

A homologacao e aceita quando os seis comandos passam, os oito cenarios da matriz estao verdes e a amostra SQL mantem `rawContentLogged=false`. Divergencia entre `ragIntentDetected`, `ragSkippedReason`, `ragMode` e `ragSourceCount` deve ser tratada como regressao ate explicacao tecnica.

Bloqueie a homologacao se houver qualquer um destes sinais:

- prompt, documento, header, token, credencial ou API key em metadata, eventos ou evidencia;
- RAG anexado sem `ragIntentDetected=true`;
- fallback externo em `knowledge_only` ou em `general_allowed`;
- pergunta geral disparando RAG em modo que deveria ignora-la;
- retrieval stub hybrid sem prioridade lexical;
- falha de typecheck, testes, smoke ou `git diff --check`.

## Diagnostico rapido

- Falha em marker estatico: confirme se houve renomeacao intencional e atualize teste, runbook e smoke no mesmo change set.
- Matriz de escopo falhou: inspecione primeiro o detector em `agent-runs.service.ts`, depois a metadata enviada pelo builder e a instrucao de escopo.
- `ragMode=resolved_context` sem resultados SQL: verifique o vinculo `rag_queries.agent_run_id` e o evento `runtime.rag_context_attached`.
- Resultado fora de ordem: compare `rank`, `retrievalMode`, `hybridMergeApplied` e `stubKeywordPriority` antes de considerar mudanca no algoritmo.
- Campo sensivel apareceu: interrompa a coleta, restrinja acesso a evidencia e trate como incidente de observabilidade; nao replique o valor no diagnostico.

## Rollback seguro

A Fase 16K nao requer rollback de banco nem de runtime. Para reverter, remova somente o runbook, o smoke 16K e as alteracoes de testes desta fase. Nao altere migrations existentes, secrets, flags de provider, bindings MCP ou dados de homologacao como parte desse rollback.
