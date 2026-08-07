# Orchestra — Fase 18E.2A — Hardening de dados técnicos em Knowledge e Audit

## Objetivo

Reduzir exposição de identificadores técnicos em telas de homologação, mantendo rastreabilidade governada e sem alterar schema, migrations, deploy, provider externo, embeddings, MCP remoto ou Chat/AgentRun real.

## Escopo implementado

### Knowledge Detail

A coluna "Enviado por" deixou de depender apenas de `createdById`.

O backend passou a incluir o relacionamento `createdBy` nos documentos de Knowledge e o mapper passou a serializar:

- `createdBy.id`
- `createdBy.name`
- `createdBy.email`

O frontend passou a priorizar `document.createdBy?.name`.

Fallback seguro preservado:

- quando houver nome real: exibe o nome do usuário;
- quando houver apenas UUID: exibe "Usuário interno";
- quando não houver usuário: exibe "Orchestra".

Resultado homologado localmente:

- "Enviado por" exibindo "Leonardo Silva" na tela de detalhe de Knowledge.

### Auditoria

A tela de Auditoria passou a usar helper de exibição segura para:

- não exibir `actorUserId` bruto como usuário;
- não exibir `entityId` completo como recurso;
- preservar referência compacta quando necessário.

Exemplo esperado:

- usuário: "Usuário interno"
- recurso: "Mcp server · ref. 00000000…000018d0"

## Arquivo helper criado

- `frontend/src/lib/display-safety.ts`

Funções principais:

- `isUuid`
- `compactTechnicalId`
- `humanizeTechnicalToken`
- `displayUserLabel`
- `displayResourceLabel`
- `safeSummaryPreview`

## Arquivos alterados

- `backend/src/modules/knowledge/knowledge.repository.ts`
- `backend/src/modules/knowledge/knowledge.mapper.ts`
- `frontend/src/services/knowledge.service.ts`
- `frontend/src/services/audit.service.ts`
- `frontend/src/lib/display-safety.ts`

## Fora de escopo

- Analytics/input_summary
- Assistant Detail/inputSummary
- mudanças de schema Prisma
- migrations
- seed
- deploy
- produção
- execução real de MCP remoto
- execução real de provider externo
- embeddings reais
- Chat/AgentRun real

## Validações

Executadas localmente:

- `git diff --check`
- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `scripts/smoke-homologacao-ui-18a.sh --dry-run`
- `scripts/smoke-release-homologavel-17d.sh --dry-run`
- `scripts/smoke-mcp-tools-governado-local-18d.sh --dry-run`
- `scripts/preflight-mcp-tools-governado-local-18d.sh --dry-run`

Resultados:

- 18A UI smoke: PASS=80 FAIL=0
- 17D release smoke: PASS=111 FAIL=0
- 18D governed local MCP smoke: PASS=47 FAIL=0
- 18D governed local MCP preflight: PASS=81 FAIL=0

## Decisão

18E.2A aprovada para commit local.

Próximo bloco sugerido:

- 18E.2B — Hardening de `input_summary` em Analytics e Assistant Detail.
