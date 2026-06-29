# Orchestra Observabilidade - Admin Read API 12C

## 1. Objetivo

A Fase 12C expõe uma API interna, administrativa e backend-only para consultar os eventos de uso da 12A, agregar métricas operacionais, ler as policies da 12B e simular a avaliação de limites sem efeitos colaterais.

A API não cria dashboard, não oferece CRUD de policies e não conecta decisões de limite ao runtime produtivo.

## 2. Rotas

Base path: `/api/v1/ai-observability`.

- `GET /usage-events`: lista eventos de uso com paginação e filtros allowlist.
- `GET /usage-events/:id`: retorna detalhe sanitizado de um evento.
- `GET /usage-summary`: agrega contadores, tokens, custo, latência, falhas e bloqueios.
- `GET /limit-policies`: lista policies visíveis, ocultando soft-deleted por padrão.
- `GET /limit-policies/:id`: retorna uma policy não removida dentro do escopo.
- `POST /limit-evaluation`: simula `evaluateAiUsageLimits` sem persistir ou executar runtime.

Não existem rotas POST, PUT, PATCH ou DELETE para criar ou alterar policies.

## 3. Auth e RBAC

Todas as rotas usam `requireAuth` e `requirePermission('audit.read')`.

`audit.read` já existe no RBAC e nos seeds, sendo atribuída aos papéis administrativos e de auditoria adequados. A 12C não adiciona permissão, não altera seeds e não modifica Auth, SSO ou a resolução global de RBAC.

## 4. Scoping

O `tenantId` é lido exclusivamente de `req.user.tenant.id`. Queries e body são schemas estritos e não aceitam `tenantId` livre.

Os IDs dos workspaces permitidos vêm de `req.user.workspaces`:

- filtro `workspaceId` fora desse conjunto retorna 403 antes de acessar o repository;
- listagens sempre combinam tenant da sessão e workspace permitido;
- detalhes fora do tenant/workspace retornam 404;
- filtros de assistant e user permanecem subordinados aos eventos dos workspaces permitidos;
- policies de assistant e user são validadas pelas relações do Prisma com workspace/membership;
- a avaliação confirma que assistant e user, quando informados, pertencem ao tenant e workspace selecionados.

## 5. Usage events

A listagem permite somente workspace, assistant, user, run, trace, source, operation, provider, model, status, intervalos de `startedAt`/`createdAt`, paginação e quatro opções de sort.

O repository usa `select` explícito. A listagem não seleciona nem retorna metadata. O detalhe seleciona metadata, mas o mapper reaplica `sanitizeAiUsageMetadata`, incluindo limites de profundidade, quantidade de itens, chaves e tamanho de strings.

Os DTOs nunca retornam rows Prisma diretamente. `estimatedCostMinorUnits` é serializado como string.

## 6. Usage summary

O summary agrega exclusivamente `ai_run_usage_events`, sem materialized view ou cache.

Groupings permitidos:

- `none`, `workspace`, `assistant`, `user`;
- `source`, `operation`, `provider`, `model`, `status`;
- `day`, `month`.

Métricas retornadas:

- `eventCount` e `runCount` distinto;
- input, output, total, embedding e cached tokens;
- `estimatedCostMinorUnits`;
- `avgLatencyMs`;
- runs distintos com status failed e blocked.

Contagens, tokens e custo são convertidos para texto no PostgreSQL e retornados como strings JSON. Isso evita passagem por float ou `number` inseguro. Apenas a média técnica de latência usa number.

## 7. Limit policies read-only

A API oferece filtros fechados para escopo, métrica, período, modo, status, dimensões técnicas, paginação e sort.

Por padrão, `deletedAt != null` é ocultado. `includeDeleted=true` é permitido para usuários com `audit.read` apenas na listagem. O detalhe continua ocultando policy removida.

O DTO omite tenant e metadata, serializa `limitValue` e `warnThresholdValue` como string e expõe apenas os campos administrativos allowlisted.

## 8. Limit evaluation read-only

O POST de avaliação aceita workspace obrigatório, assistant/user opcionais, dimensões técnicas, `projectedUsage` e `now` apenas fora de produção. O body é estrito e rejeita tenant, metadata, prompt, response e quaisquer campos não reconhecidos.

Depois do scoping, o service chama o evaluator `evaluateAiUsageLimits` da 12B. O resultado retorna `allowed`, `status`, `mode` e decisões normalizadas. Todos os valores bigint e timestamps são convertidos para strings JSON/ISO.

A simulação não grava evento, não cria audit de uso, não altera policy, não chama runtime, provider, MCP ou rede externa. Uma decisão `enforce` bloqueada é apenas informação da resposta.

## 9. Segurança e privacidade

Não são expostos prompt, response, raw documents, raw request/response, headers, Authorization, cookies, token, apiKey, password, secret, credential, secretRef, baseUrl, connection string ou payload bruto.

Schemas Zod `.strict()`, selects Prisma explícitos, mappers allowlist, scoping no repository e sanitização defensiva formam camadas independentes. Erros usam o handler normal da aplicação e não expõem stack em produção.

## 10. Fora de escopo

Permanecem fora da 12C:

- frontend, dashboard visual e gráficos;
- alertas e notificações;
- billing, invoice, payment gateway e export financeiro;
- avaliação automática de qualidade e test sets;
- CRUD de policies;
- enforcement automático no runtime;
- worker, scheduler, scraping ou chamadas externas;
- execução MCP remota e materialização em `McpTool`;
- integração Agno/AgentOS produtiva;
- alteração de schema ou migration Prisma.

## 11. Próximos passos

- 12D: alertas e notificações governadas.
- 13A: avaliação simples e test sets.
- Fase posterior: dashboard frontend consumindo a API read-only.

## 12. Riscos remanescentes

- Summary executa agregação online e ainda não possui cache, rollup ou retenção para alto volume.
- `includeDeleted` depende da permissão ampla `audit.read`; uma permissão dedicada pode surgir quando o RBAC evoluir.
- Grouping por operation/model pode produzir alta cardinalidade.
- A API depende da cobertura de eventos e da qualidade de instrumentação da 12A.
- Pricing real, moedas múltiplas e timezone por tenant continuam não modelados.
