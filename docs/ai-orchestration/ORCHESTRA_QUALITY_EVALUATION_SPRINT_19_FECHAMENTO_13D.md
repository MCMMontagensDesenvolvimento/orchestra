# Orchestra Quality Evaluation Sprint 19 Fechamento 13D

## 1. Resumo executivo

A Sprint 19/Fase 13 criou a camada governada de avaliacao de qualidade de assistentes de IA no Orchestra. A entrega cobre test sets, test cases, evaluation runs, evaluation results, evaluator deterministico por assertions, runs deterministicos persistidos, snapshots sanitizados, RBAC dedicado e CRUD governado.

A Fase 13 ainda nao adiciona LLM-as-judge, nao executa assistant/runtime automaticamente, nao chama provider externo e nao integra MCP remoto ou Agno/AgentOS produtivo. O output candidato continua sendo fornecido explicitamente por um admin/caller autorizado.

Resumo por subfase:

- 13A criou a fundacao de `AiQualityTestSet`, `AiQualityTestCase`, `AiQualityEvaluationRun` e `AiQualityEvaluationResult`, alem do evaluator deterministico por assertions e da API admin inicial de leitura/simulacao.
- 13B adicionou runs/results deterministicos persistidos, transacao de results, snapshots sanitizados de assistant/test set e garantia de que `candidateOutput` completo nao e persistido.
- 13C adicionou RBAC dedicado `ai.quality.read`/`ai.quality.write`, CRUD governado de test sets/test cases, autoria, lifecycle archive/restore e audit trail sanitizado.
- 13D consolida fechamento documental, runbook, checklist tecnico, riscos remanescentes e backlog recomendado para o proximo ciclo.

## 2. Arquitetura entregue

Componentes principais:

- `AiQualityTestSet`: agrupa casos por tenant, workspace opcional e assistant opcional.
- `AiQualityTestCase`: declara entrada, saida esperada opcional, assertions, tags, status, ordenacao, metadata e autoria.
- `AiQualityEvaluationRun`: representa uma execucao deterministica sincrona de um test set, com status, modo, contadores, score, snapshots e autoria.
- `AiQualityEvaluationResult`: guarda o resultado sanitizado por test case, com status, score, assertion results, hash/excerpt curto de candidate output e metadata segura.
- Evaluator deterministico: avalia assertions locais sem rede, provider, runtime, MCP ou Agno.
- Deterministic run runner: valida o escopo, exige `candidateOutput` explicito para cada caso ativo, avalia e persiste run/results em transacao.
- Snapshots sanitizados: summaries allowlist de assistant/test set, canonicalizados e hasheados.
- RBAC `ai.quality.read`/`ai.quality.write`: substitui a dependencia temporaria de `audit.read`.
- Audit trail de escritas: registra criacao/alteracao/archive/restore de sets/cases e criacao de run, sem conteudo sensivel.

Fluxo operacional:

1. Admin cria test set.
2. Admin cria test cases com assertions.
3. Admin simula um caso individual com `candidateOutput`.
4. Admin cria run deterministico para um test set inteiro, enviando `candidateOutput` por test case.
5. Sistema valida escopo, avalia assertions, persiste run/results, cria snapshots e registra auditoria.
6. Leitores consultam historico por RBAC dedicado.

## 3. Rotas entregues

Base path: `/api/v1/ai-quality`.

Rotas de leitura e simulacao nao persistida (`ai.quality.read`):

```txt
GET  /api/v1/ai-quality/test-sets
GET  /api/v1/ai-quality/test-sets/:id
GET  /api/v1/ai-quality/test-cases
GET  /api/v1/ai-quality/test-cases/:id
GET  /api/v1/ai-quality/evaluation-runs
GET  /api/v1/ai-quality/evaluation-runs/:id
GET  /api/v1/ai-quality/evaluation-runs/:id/results
GET  /api/v1/ai-quality/evaluation-results
POST /api/v1/ai-quality/evaluate-test-case
```

Rotas de escrita (`ai.quality.write`):

```txt
POST  /api/v1/ai-quality/test-sets
PATCH /api/v1/ai-quality/test-sets/:id
POST  /api/v1/ai-quality/test-sets/:id/archive
POST  /api/v1/ai-quality/test-sets/:id/restore
POST  /api/v1/ai-quality/test-cases
PATCH /api/v1/ai-quality/test-cases/:id
POST  /api/v1/ai-quality/test-cases/:id/archive
POST  /api/v1/ai-quality/test-cases/:id/restore
POST  /api/v1/ai-quality/evaluation-runs/deterministic
```

Nao existe exclusao fisica, scheduler, worker, fila, dashboard ou execucao automatica de assistant.

## 4. RBAC

Permissoes dedicadas:

```txt
ai.quality.read
ai.quality.write
```

Regras:

- `audit.read` nao libera mais AI Quality.
- `ai.quality.read` libera consultas e `POST /evaluate-test-case`, que e uma simulacao deterministica sem persistencia.
- `ai.quality.write` libera CRUD de test sets/test cases, archive/restore e criacao de run deterministico persistido.

Observacao operacional: ambientes existentes precisam aplicar migrations e rodar bootstrap/seed de permissoes para registrar `ai.quality.read` e `ai.quality.write` nos perfis esperados. A migration estrutural nao deve ser tratada como substituta do bootstrap de roles/permissoes.

## 5. Seguranca e privacidade

Garantias implementadas/documentadas:

- tenant vem da sessao autenticada;
- workspace fora do escopo retorna 403;
- recursos fora do escopo retornam 404;
- DTOs sao allowlist;
- schemas Zod `.strict()` rejeitam campos desconhecidos;
- metadata e sanitizada e limitada;
- `candidateOutput` completo nao e persistido;
- `candidateOutput` completo nao e retornado;
- results persistem apenas hash SHA-256 e excerpt sanitizado de `candidateOutput`;
- snapshots sao summaries sanitizados;
- auditoria nao grava `inputText`, `expectedOutput`, assertions completas nem `candidateOutput` completo;
- nao ha chamada externa;
- nao ha provider;
- nao ha runtime;
- nao ha MCP;
- nao ha Agno;
- nao ha scheduler, worker, queue, cron, dashboard, billing, webhook ou alert delivery.

Campos e valores sensiveis como `providerApiKey`, `headers`, `Authorization`, `cookie`, `rawDocuments`, `token`, `password`, `secret`, `credential`, `secretRef`, `baseUrl`, prompt bruto e response bruta sao rejeitados ou removidos em metadata/summaries conforme o ponto de entrada.

## 6. Assertions deterministicas

Assertions suportadas:

```txt
contains_any
contains_all
not_contains_any
min_length
max_length
regex_contains
regex_not_contains
json_valid
```

Cada assertion possui severidade `required` ou `warning`; quando omitida, a severidade padrao e `required`.

Status de result:

- `passed`: todas as assertions passaram.
- `failed`: ao menos uma assertion `required` falhou.
- `warning`: nao houve falha `required`, mas ao menos uma assertion `warning` falhou.
- `error`: reservado para falha controlada de result/run.
- `skipped`: reservado para casos nao avaliados; no runner deterministico normal, missing output e rejeitado com 422 em vez de persistir skipped.

O score de cada result e calculado em basis points de 0 a 10000, pela proporcao simples de assertions que passaram. O score do run e a media inteira (`Math.round`) dos scores dos results nao skipped.

Regex usa limites conservadores de tamanho, flags allowlist (`i`, `m`, `u`) e execucao sobre texto limitado. Comparacoes `contains_*` sao case-insensitive por padrao, salvo `caseSensitive: true`.

## 7. Snapshots

Campos de snapshot no run:

- `assistantSnapshotHash`;
- `assistantSnapshotSummary`;
- `testSetSnapshotHash`;
- `testSetSnapshotSummary`.

Os hashes sao SHA-256 em hexadecimal lowercase, calculados sobre snapshot canonicalizado. O snapshot canonicalizado ordena chaves recursivamente antes de serializar para JSON.

`assistantSnapshotSummary` usa allowlist minima:

- `assistantId`;
- `name`;
- `status`;
- `workspaceId`;
- `capturedAt`.

`testSetSnapshotSummary` usa allowlist minima:

- `testSetId`;
- `name`;
- `status`;
- `workspaceId`;
- `assistantId`;
- `testCaseCount`;
- `activeTestCaseCount`;
- `capturedAt`.

Nao entram nos snapshots: prompt completo, instrucoes completas, secrets, headers, Authorization, cookies, base URL, raw documents, RAG chunks, payload bruto, `candidateOutput` completo ou resposta completa de provider.

## 8. Operacao e runbook

Passos seguros para habilitar e operar AI Quality Evaluation:

1. Aplicar migrations do backend com o fluxo padrao do ambiente.
2. Rodar bootstrap/seed de permissoes para registrar `ai.quality.read` e `ai.quality.write`.
3. Validar que os perfis esperados receberam as permissoes: admin/editor com leitura e escrita, auditor com leitura quando aplicavel.
4. Criar um test set com `POST /api/v1/ai-quality/test-sets`.
5. Criar test cases com `POST /api/v1/ai-quality/test-cases`, sempre evitando secrets, PII desnecessaria e payload bruto produtivo.
6. Simular caso individual com `POST /api/v1/ai-quality/evaluate-test-case`, enviando `candidateOutput` explicitamente.
7. Criar run deterministico com `POST /api/v1/ai-quality/evaluation-runs/deterministic`, enviando um `candidateOutput` para cada test case ativo do set.
8. Consultar run e results por `GET /api/v1/ai-quality/evaluation-runs/:id` e `GET /api/v1/ai-quality/evaluation-runs/:id/results`.
9. Investigar falhas olhando status, score, assertion results, hashes/excerpts sanitizados e auditoria de escrita.
10. Arquivar/restaurar test sets/cases por endpoints dedicados quando o ciclo de manutencao exigir.

Comandos seguros de validacao local:

```bash
cd ~/projetos/orchestra/backend
npm run typecheck
npm run lint

MICROSOFT_SSO_ENABLED=false \
MICROSOFT_CLIENT_ID= \
MICROSOFT_CLIENT_SECRET= \
MICROSOFT_TENANT_ID= \
MICROSOFT_REDIRECT_URI= \
MICROSOFT_POST_LOGOUT_REDIRECT_URI= \
MICROSOFT_ALLOWED_DOMAINS= \
MICROSOFT_ALLOWED_TENANT_IDS= \
npm run test -- --run

npm run build
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Na raiz:

```bash
cd ~/projetos/orchestra
git status --short
git diff --check
git diff --stat
git diff --name-status
```

Nao usar `docker compose down -v`, reset de banco, drop de volume ou comandos destrutivos para validar esta fase.

## 9. Validacoes executadas

Registrar resultado real da Fase 13D:

```txt
npm run typecheck: passou
npm run lint: passou
npm run test -- --run: passou, 36 arquivos e 378 testes
npm run build: passou
npx prisma validate: passou
npx prisma generate: passou
npx prisma migrate status: falhou por ambiente, P1001 em db:5432
git diff --check: passou, sem saida
grep de segredos: passou, sem ocorrencias
grep amplo de seguranca: 868 ocorrencias esperadas em sanitizacao, testes, docs e termos defensivos; sem segredo real, sem chamada externa nova e sem runtime/MCP/Agno produtivo no modulo AI Quality
```

Se `npx prisma migrate status` falhar por indisponibilidade de banco, por exemplo `P1001` em `db:5432`, a limitacao deve ser registrada como falha de ambiente. Nao resetar banco, nao dropar volume e nao executar comando destrutivo.

## 10. Riscos remanescentes

- permissoes novas dependem de seed/bootstrap nos ambientes existentes;
- nao ha dashboard;
- nao ha read-model agregado de comparacao historica;
- nao ha LLM-as-judge;
- nao ha geracao automatica de outputs/casos;
- snapshots sao summaries, nao reproducao integral do assistant;
- test cases podem conter conteudo sensivel se o usuario cadastrar indevidamente;
- e necessario orientar usuarios/admins a nao inserir secrets em `inputText`/`expectedOutput`;
- archive de test set nao arquiva automaticamente test cases;
- regex safety e conservadora e pode rejeitar padroes complexos;
- comparacoes semanticas continuam fora do escopo.

## 11. Backlog recomendado

P0/P1:

- validar bootstrap/seed em ambiente de homologacao;
- documentar permissoes no manual admin;
- criar testes end-to-end minimos se o projeto tiver estrutura adequada;
- criar consulta agregada de runs por test set/assistant;
- revisar playbook de dados sensiveis para autores de test cases.

P2:

- dashboard read-only de quality evaluation;
- comparacoes historicas por assistant/test set;
- export CSV/JSON de run;
- filtros avancados;
- read-model agregado para tendencia de score, falhas recorrentes e cobertura por tag.

P3/futuro:

- LLM-as-judge governado;
- integracao com runtime/Agno;
- execucao automatica controlada;
- budgets e quotas especificos para avaliacao semantica;
- politica de retencao para payloads usados em avaliacao semantica.

## 12. Decisao sobre LLM-as-judge

LLM-as-judge foi deliberadamente adiado.

Motivos:

- exige provider real;
- gera custo;
- pode processar dados sensiveis;
- precisa de politica de retencao;
- precisa de limites e quotas;
- precisa de auditoria propria;
- precisa de comportamento fail-closed;
- precisa separar permissao de leitura/escrita local de qualquer operacao externa persistente.

A proxima fase de LLM-as-judge deve ser desenhada separadamente, com contrato explicito de provider, custo, privacidade, retencao, auditoria, quotas, fallback e criterios de bloqueio.

## 13. Checklist tecnico de aceite

- [x] Fechamento consolidado de 13A/13B/13C documentado.
- [x] Arquitetura, rotas, RBAC, seguranca, snapshots, runbook e backlog documentados.
- [x] LLM-as-judge explicitamente fora do escopo.
- [x] Execucao de provider/runtime/MCP/Agno explicitamente fora do escopo.
- [x] Scheduler, worker, queue, dashboard, billing, webhook e alert delivery fora do escopo.
- [x] Documento mantido como handoff/documentacao, sem nova feature.
- [x] Validacoes finais registradas apos execucao.
