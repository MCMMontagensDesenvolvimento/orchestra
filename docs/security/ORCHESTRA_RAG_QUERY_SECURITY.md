# Orchestra RAG Query Security

Status: implementado na Fase 06C para consulta local governada.

## Principios

- Backend e autoridade de autorizacao, escopo e auditoria.
- Frontend apenas consome readiness, historico e citations.
- Consulta local nao chama provider externo, LLM, embeddings, vector store, runtime real ou MCP real.
- Dados arquivados, bindings desabilitados e workspaces fora de escopo nao entram no retrieval.

## Autorizacao

Rotas de query exigem:

- sessao autenticada;
- permissao `knowledge.read`;
- assistant dentro do tenant/workspace do usuario;
- Knowledge Bases vinculadas ao assistant;
- bindings habilitados;
- documentos ingeridos e nao arquivados;
- chunks ativos.

A fase reutiliza `knowledge.read` para query local porque a consulta nao executa runtime nem altera Knowledge. Permissoes dedicadas como `rag.query` podem ser adicionadas quando a organizacao exigir separacao mais fina entre leitura de catalogo e consulta operacional.

## ABAC E Escopo

O service filtra:

- `tenantId`;
- `workspaceId`;
- `assistantId`;
- `knowledgeBaseId` via binding;
- status de Knowledge Base;
- status e ingestion status de documento;
- status do chunk.

Bindings fora do workspace do assistant aparecem como bloqueio ou warning e nao entram na consulta.

## Auditoria Sanitizada

Eventos de auditoria registram:

- `queryId`;
- `assistantId`;
- `knowledgeBaseIds`;
- `documentIds`;
- `resultCount`;
- `status`;
- `requestId`;
- `traceId`;
- `blockedReason`.

Nao registrar em audit logs:

- documento completo;
- chunk completo;
- pergunta completa;
- prompt final;
- secrets;
- tokens;
- payloads extensos.

## Exposicao De Conteudo

O response de query retorna `excerpt` limitado e metadados de fonte. O conteudo integral so permanece acessivel pelas rotas governadas de Knowledge ja existentes e com a mesma permissao.

## Riscos E Controles

- Matching keyword pode retornar resultado lexicalmente proximo, mas nao semanticamente correto.
- Score e deterministico e nao deve ser interpretado como relevancia semantica.
- Source references podem estar ausentes em dados antigos; readiness retorna warning quando isso ocorre.
- Conteudo arquivado permanece bloqueado mesmo se `includeArchived=true`.
