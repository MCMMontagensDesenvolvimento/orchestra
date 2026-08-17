# Orchestra — Fase 18E.2B — Hardening de input_summary em Analytics e Assistant Detail

## Objetivo

Reduzir exposição direta de `input_summary`/`inputSummary` nas telas de Analytics e Assistant Detail, mantendo apenas uma visualização tratada e resumida para homologação.

## Escopo implementado

### Analytics

A tela de Analytics deixou de exibir `inputSummary` bruto diretamente em pontos visuais.

Ajustes realizados:

- rótulo "Buscar em input_summary" alterado para "Buscar em resumo seguro";
- placeholder "Resumo da entrada" alterado para "Resumo tratado da entrada";
- cabeçalho "Run / input_summary" alterado para "Run / resumo seguro";
- tabela passou a usar `safeSummaryPreview(run.inputSummary, 96)`;
- `title={run.inputSummary ?? undefined}` removido para evitar exposição do conteúdo completo no hover;
- detalhe do run passou de `input_summary` para "Resumo seguro da entrada";
- detalhe passou a usar `safeSummaryPreview(run.inputSummary, 180)`.

### Assistant Detail

Os cards de runs no detalhe do assistant deixaram de exibir `run.inputSummary` diretamente.

Ajuste realizado:

- `run.inputSummary || 'Entrada sem resumo'` substituído por `safeSummaryPreview(run.inputSummary, 96, 'Entrada sem resumo')`.

### Helper de segurança

O helper `frontend/src/lib/display-safety.ts` foi reforçado.

A função `safeSummaryPreview` passou a:

- normalizar espaços;
- truncar o texto exibido;
- mascarar e-mails;
- mascarar UUIDs;
- mascarar bearer tokens;
- mascarar padrões simples de `api_key`, `token`, `secret` e `password`.

## Arquivos alterados

- `frontend/src/lib/display-safety.ts`
- `frontend/src/pages/Analytics/AnalyticsPage.tsx`
- `frontend/src/pages/Assistants/AssistantDetailPage.tsx`

## Fora de escopo

- backend
- schema Prisma
- migrations
- seed
- deploy
- produção
- MCP remoto real
- provider externo real
- embeddings reais
- Chat/AgentRun real
- alteração na persistência de `inputSummary`

## Validações automáticas

Executadas localmente:

- `git diff --check`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `scripts/smoke-homologacao-ui-18a.sh --dry-run`
- `scripts/smoke-release-homologavel-17d.sh --dry-run`

Resultados:

- frontend typecheck: PASS
- frontend build: PASS
- 18A UI smoke: PASS=80 FAIL=0
- 17D release smoke: PASS=111 FAIL=0

## Homologação manual

Fase: 18E.2B — Teste UI Analytics/Assistant Detail

- Analytics label "Buscar em resumo seguro": PASS
- Analytics tabela "Run / resumo seguro": PASS
- Analytics detalhe "Resumo seguro da entrada": PASS
- Hover não expõe inputSummary bruto: PASS
- Assistant Detail usa preview tratado: PASS
- Erro console: NA
- Layout quebrado: NA

## Decisão

18E.2B aprovada para commit local.

Próximo bloco sugerido:

- 18E.2C — varredura final de rótulos técnicos e IDs expostos em telas restantes.
