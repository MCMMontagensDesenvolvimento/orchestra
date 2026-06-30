# Fase 13C — RBAC e CRUD governado de AI Quality

## Objetivo

A Fase 13C substitui a permissao temporaria `audit.read` do modulo `/api/v1/ai-quality` por RBAC dedicado e permite manter test sets e test cases de forma governada. Ela evolui a fundacao deterministica da 13A e os runs/snapshots persistidos da 13B; nao executa assistant, provider ou LLM-as-judge.

## Permissoes

- `ai.quality.read`: lista e detalha test sets, test cases, evaluation runs/results e libera `POST /evaluate-test-case`, que continua sendo simulacao sem persistencia.
- `ai.quality.write`: cria, atualiza, arquiva e restaura test sets/test cases e libera `POST /evaluation-runs/deterministic`.

O seed atribui ambas a `admin_platform`, `creator_owner` e `editor`; `auditor` recebe somente leitura. `audit.read` isoladamente nao libera nenhuma rota de AI Quality.

## API

Rotas de leitura:

- `GET /test-sets` e `GET /test-sets/:id`;
- `GET /test-cases` e `GET /test-cases/:id`;
- `GET /evaluation-runs`, `GET /evaluation-runs/:id` e `GET /evaluation-runs/:id/results`;
- `GET /evaluation-results`;
- `POST /evaluate-test-case`.

Rotas de escrita:

- `POST /test-sets`, `PATCH /test-sets/:id`, `POST /test-sets/:id/archive` e `POST /test-sets/:id/restore`;
- `POST /test-cases`, `PATCH /test-cases/:id`, `POST /test-cases/:id/archive` e `POST /test-cases/:id/restore`;
- `POST /evaluation-runs/deterministic`.

Nao existe exclusao fisica. Archive/restore muda o lifecycle entre `archived` e `active`; `disabled` continua disponivel nos corpos de update.

## Test sets

O tenant sempre vem da sessao. Um set pode ser global no tenant (`workspaceId` e `assistantId` nulos) ou vinculado a workspace/assistant visivel. Create e update aceitam apenas `workspaceId`, `assistantId`, `name`, `description`, `status` e metadata segura. A autoria fica em `createdByUserId`/`updatedByUserId`.

## Test cases

Todo caso nasce em um test set visivel e nao arquivado. Um `assistantId` explicito precisa ser visivel e coerente com o assistant do set. Create/update usam DTO allowlist e persistem `createdByUserId`/`updatedByUserId`; a migration 13C adiciona essas colunas como nullable, com indices e FKs `ON DELETE SET NULL`, sem backfill ou SQL destrutivo.

## Validacao e privacidade

- `name`: 1 a 160 caracteres; `description`: ate 2000;
- `inputText`: 1 a 8000; `expectedOutput`: ate 8000;
- `assertions`: schema discriminado da 13A, entre 1 e 50 itens;
- tags: ate 25 strings unicas, cada uma com 1 a 80 caracteres;
- metadata: JSON seguro de ate 4000 bytes e limites de profundidade/itens.

Schemas `.strict()` rejeitam campos desconhecidos, incluindo `tenantId`, `providerApiKey`, `headers`, `Authorization`, `cookie`, `rawDocuments`, `secretRef`, `baseUrl`, payload produtivo e credenciais. Metadata insegura tambem e rejeitada. Repositories usam `select` explicito e mappers retornam DTOs allowlist; rows Prisma nao sao expostas diretamente.

## Scoping

`workspaceId` informado fora de `req.user.workspaces` falha com 403 antes do repository. Test sets globais sao visiveis apenas dentro do tenant. Sets/cases e assistants fora do tenant/workspace visivel retornam 404. Em updates que mudam workspace ou assistant, o service revalida a combinacao final antes da persistencia.

## Auditoria

Create/update/archive/restore de sets e cases e a criacao de run deterministico registram `recordAuditEvent`. Eventos guardam IDs, status, campos alterados, contadores e hashes de snapshot. Nao registram `inputText`, `expectedOutput`, assertions completas nem candidate output completo.

## Fora de escopo

Esta fase nao adiciona LLM-as-judge, chamada OpenAI/Azure/Anthropic/Gemini, runtime de assistant, MCP remoto, Agno/AgentOS, geracao automatica de casos/outputs, execucao assincrona, scheduler, worker, queue, cron, dashboard, billing, alert delivery, webhook ou frontend.

## Riscos e proximos passos

- Permissoes novas dependem da execucao do bootstrap/seed nos ambientes existentes; a migration estrutural nao altera automaticamente roles de tenants ja provisionados.
- Archive de test set nao altera em cascata os casos; o scoping e o runner continuam verificando o status do set.
- O passo futuro para LLM-as-judge deve criar contrato e policy separados, manter provider fail-closed, controlar custo/dados e nunca reutilizar `ai.quality.read` para operacao externa persistente.
