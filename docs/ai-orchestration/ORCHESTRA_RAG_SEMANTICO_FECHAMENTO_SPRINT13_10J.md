# Orchestra RAG Semantico - Fechamento Sprint 13 / Fase 10J

## Resumo Executivo

A Sprint 13 consolidou a capacidade governada de RAG semantico do Orchestra. O resultado final e uma trilha backend-only para ingestao textual, chunking local, geracao controlada de embeddings, persistencia idempotente em pgvector, retrieval semantico com fallback lexical e integracao ao contrato oficial de `queryRag` com `RagQuery`, `RagQueryResult`, citations e auditoria.

A capacidade esta pronta como backend governado. Ela nao habilita chamadas de provider no frontend, nao retorna vetores, nao persiste raw input/output e opera em modo fail-closed quando embeddings nao estao prontos.

## Linha Do Tempo 10A-10I

- 10A: discovery tecnico do RAG atual, limites do retrieval lexical e plano para RAG semantico.
- 10B: decisao de vector store com pgvector e contrato de embeddings governados.
- 10C: schema e migration para `knowledge_chunk_embeddings` com extensao pgvector.
- 10D: embeddings backend-only em modo fail-closed, sem provider externo ativo por padrao.
- 10E: provider governado de embeddings com readiness diferenciada.
- 10F: execucao OpenAI controlada e mockavel no backend, sem internet nos testes.
- 10G: persistencia controlada e idempotente de embeddings por chunk, provider, model, dimension e content hash.
- 10H: endpoint backend-only de retrieval semantico com fallback lexical.
- 10I: integracao do retrieval semantico ao `queryRag` oficial com citations, persistencia e auditoria.
- 10J: fechamento tecnico, smoke final, checklist operacional e documentacao de aceite.

## Arquitetura Final

A arquitetura final permanece backend-only:

- `knowledgeService` coordena ingestao, embeddings, retrieval e query oficial.
- `embeddingsService` encapsula readiness, provider e execucao de embeddings.
- `knowledge_chunk_embeddings` armazena embeddings governados com provider, model, dimension, content hash, status e metadata segura.
- pgvector executa similaridade vetorial no banco, sem expor vetores ao cliente.
- `POST /api/v1/assistants/:id/rag/semantic-search` permite validar retrieval semantico isolado, com fallback opcional.
- `POST /api/v1/assistants/:id/rag/query` e o contrato oficial, persistindo `RagQuery`, `RagQueryResult`, citations e auditoria.
- O fallback lexical usa os chunks locais ja autorizados e preserva o comportamento operacional quando embeddings nao estao prontos ou nao retornam resultados.

## Fluxo Operacional

1. Configurar embeddings no backend.
2. Criar ou atualizar uma base de conhecimento.
3. Criar documento com conteudo textual.
4. Solicitar ingestao local para gerar chunks e source references.
5. Solicitar embeddings por documento ou por base.
6. Validar retrieval semantico isolado em `/rag/semantic-search`, quando necessario.
7. Consultar `/rag/query` para o contrato oficial com `queryId`, `sources`, citations e auditoria.
8. Acompanhar historico e fontes por `GET /api/v1/assistants/:id/rag/queries`, `GET /api/v1/rag/queries/:queryId` e `GET /api/v1/rag/queries/:queryId/sources`.

## Configuracoes

Variaveis esperadas no backend:

- `EMBEDDINGS_ENABLED`: habilita a capacidade de embeddings.
- `EMBEDDINGS_PROVIDER`: provider configurado, como `openai`.
- `EMBEDDINGS_EXECUTION_ENABLED`: habilita execucao real de embeddings quando permitido.
- `EMBEDDINGS_MODEL`: modelo de embeddings.
- `EMBEDDINGS_DIMENSION`: dimensao esperada do vetor.
- `OPENAI_API_KEY`: credential backend-only quando o provider OpenAI estiver em uso.

Nenhuma dessas configuracoes deve ser exposta ao frontend. Valores reais de secrets nao devem ser documentados, persistidos em metadata ou retornados por API.

## Contratos Principais

### Solicitar Embeddings Por Documento

```http
POST /api/v1/knowledge-documents/:documentId/request-embeddings
```

Permissao: `knowledge.ingestion.manage`.

Payload:

```json
{
  "limit": 50,
  "force": false,
  "chunkIds": ["uuid"],
  "metadata": {}
}
```

### Solicitar Embeddings Por Base

```http
POST /api/v1/knowledge-bases/:id/request-embeddings
```

Permissao: `knowledge.ingestion.manage`.

Usa o mesmo payload de embeddings por documento.

### Semantic Search Isolado

```http
POST /api/v1/assistants/:id/rag/semantic-search
```

Permissao: `knowledge.read`.

Payload:

```json
{
  "query": "politica operacional",
  "limit": 5,
  "fallback": true
}
```

Este endpoint nao persiste `RagQuery` oficial. Ele serve para validar retrieval semantico backend-only.

### Query RAG Oficial

```http
POST /api/v1/assistants/:id/rag/query
```

Permissao: `knowledge.read`.

Payload:

```json
{
  "query": "politica operacional",
  "limit": 5,
  "includeArchived": false
}
```

Sempre persiste `RagQuery`. Quando houver fontes, persiste `RagQueryResult` com citations.

## Modos De Retrieval

- `semantic_vector`: retrieval semantico usado no contrato oficial.
- `semantic_fallback_local_keyword`: query oficial tentou caminho semantico e caiu para lexical/local.
- `local_keyword`: retrieval lexical/local preservado para compatibilidade operacional.
- `local_readiness`: readiness bloqueou a consulta antes de retrieval.
- `fallback_local_keyword`: fallback lexical do endpoint isolado `/rag/semantic-search`.

## Seguranca E Governanca

- Provider secrets ficam somente no backend.
- Frontend nao chama OpenAI, Azure OpenAI ou qualquer provider de embeddings.
- APIs nao retornam query vector nem chunk vector.
- APIs nao retornam raw input/output do provider.
- Metadata nao deve persistir prompt bruto, output bruto, segredo, token, cookie ou header sensivel.
- Embeddings operam em modo fail-closed quando configuracao ou execucao nao estao prontas.
- O provider real so e chamado quando `EMBEDDINGS_ENABLED` e `EMBEDDINGS_EXECUTION_ENABLED` permitem e o backend esta configurado.
- Testes usam mocks e nao dependem de internet.

## Auditoria

Eventos relevantes de embeddings:

- `knowledge_embeddings_requested`;
- `knowledge_embeddings_completed`;
- `knowledge_embeddings_failed`.

Eventos relevantes de semantic search:

- `rag_semantic_search_requested`;
- `rag_semantic_search_completed`;
- `rag_semantic_search_fallback`;
- `rag_semantic_search_failed`.

Eventos relevantes da query oficial:

- `rag_query_requested`;
- `rag_query_completed`;
- `rag_query_no_results`;
- `rag_query_blocked`;
- `rag_query_failed`;
- `rag_source_returned`.

A auditoria registra status, modo de retrieval, fallback, provider/model/dimension e contadores, sem vetores ou credenciais.

## Persistencia

`knowledge_chunk_embeddings`:

- idempotencia por `chunk_id`, `provider`, `model`, `dimension` e `content_hash`;
- status `embedded` ou `failed`;
- embedding armazenado em pgvector somente no banco;
- metadata segura e sanitizada.

`RagQuery`:

- guarda query oficial, status, modo efetivo, limites, requestId/traceId e metadata operacional segura;
- usa `mode` para diferenciar `semantic_vector`, fallback lexical e readiness.

`RagQueryResult`:

- guarda fontes retornadas, rank, score, `matchType`, excerpt limitado e `citationLabel`;
- preserva `sourceReferenceId` quando disponivel;
- metadata segura inclui dados como chunk index, token estimate, char count, document title, source reference label e, no caminho semantico, score/distancia semantica.

## Criterios De Aceite Final

- Documentacao final da Sprint 13 criada.
- README de `docs/ai-orchestration` atualizado.
- Nenhuma feature nova implementada.
- Nenhum comportamento funcional alterado.
- Frontend nao alterado.
- Auth/SSO nao alterado.
- RBAC nao alterado.
- MCP/runtime nao alterados.
- Prisma schema e migrations nao alterados.
- Validacoes backend passam.
- Prisma migrate status indica schema atualizado.
- `git diff --check` passa.
- Nenhum segredo real foi adicionado.
- O documento deixa claro que RAG semantico esta pronto como capacidade backend governada com fallback lexical.

## Smoke Final

Smoke tecnico recomendado para revisao humana:

1. Subir stack dev com banco.
2. Confirmar migrations atualizadas.
3. Rodar typecheck, lint, testes, build e Prisma validate/generate.
4. Em ambiente controlado, configurar embeddings backend-only.
5. Ingerir documento real de teste.
6. Solicitar embeddings por documento ou base.
7. Chamar `/rag/semantic-search` e validar `retrievalMode`.
8. Chamar `/rag/query` e validar `queryId`, `sources`, citations, `RagQuery`, `RagQueryResult` e auditoria.

Nesta fase 10J, nao deve ser feita chamada real para OpenAI durante validacao local automatizada.

## Validacoes Executadas Na 10J

Resultado desta rodada:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `MICROSOFT_SSO_ENABLED=false ... npm run test -- --run`: PASS na repeticao final, com 15 arquivos e 144 testes. A primeira tentativa teve 3 timeouts em `tests/api/llm.test.ts`; o arquivo passou isolado em seguida, e a suite completa passou na repeticao.
- `npm run build`: PASS.
- `npx prisma validate`: PASS.
- `npx prisma generate`: PASS.
- `docker compose -f docker-compose.dev.yml exec -T backend npx prisma migrate status`: PASS, database schema up to date.
- `git diff --check`: PASS.
- Greps de seguranca: PASS, sem ocorrencias nos comandos executados.

Comandos obrigatorios:

```bash
cd backend
npm run typecheck
npm run lint
MICROSOFT_SSO_ENABLED=false MICROSOFT_CLIENT_ID= MICROSOFT_CLIENT_SECRET= MICROSOFT_TENANT_ID= MICROSOFT_REDIRECT_URI= MICROSOFT_POST_LOGOUT_REDIRECT_URI= MICROSOFT_ALLOWED_DOMAINS= MICROSOFT_ALLOWED_TENANT_IDS= npm run test -- --run
npm run build
npx prisma validate
npx prisma generate
```

```bash
docker compose -f docker-compose.dev.yml exec -T backend npx prisma migrate status
git status --short
git diff --check
git diff --stat
git diff --name-status
```

## Rollback Seguro

Rollback da capacidade semantica, se necessario:

1. Desabilitar embeddings por configuracao, mantendo fail-closed.
2. Remover uso operacional de `/rag/semantic-search`.
3. Reverter a integracao semantica em `queryRag` para o caminho lexical/local.
4. Manter `knowledge_chunk_embeddings` intacta ate uma decisao explicita de limpeza, pois ela contem estado derivado e auditavel.
5. Nao resetar banco e nao usar `docker compose down -v` como rollback.

Rollback desta fase 10J:

1. Reverter apenas este documento e a linha do README.
2. Nenhum rollback funcional e necessario, pois a fase e documental.

## Limitacoes Conhecidas

- Nao ha worker assincrono para embeddings.
- Nao ha fila/retry operacional dedicado para embeddings.
- Nao ha indice HNSW/IVFFlat; pgvector pode exigir tuning quando o volume crescer.
- Nao ha smoke automatizado com embeddings reais em ambiente controlado.
- Observabilidade de custo, latencia, taxa de fallback e qualidade ainda precisa evoluir.
- Integracao plena com runtime/assistentes para resposta gerada por LLM continua dependente das proximas fases.
- Avaliacao automatica de qualidade/eval ainda nao esta implementada.

## Proximas Fases Recomendadas

- Observabilidade, custos, limites e retries de embeddings/RAG.
- Worker assincrono e fila idempotente para embeddings.
- Indices vetoriais HNSW ou IVFFlat quando houver volume que justifique.
- Smoke com embeddings reais em ambiente controlado, sem expor secrets.
- Integracao futura com runtime/assistentes quando o contrato de execucao exigir fontes semanticas.
- Metricas de qualidade, cobertura de fontes e avaliacao automatica.

## Decisao De Fechamento

A Sprint 13 esta apta para fechamento tecnico. A capacidade de RAG semantico esta pronta como backend governado, com persistencia auditavel, fallback lexical, readiness fail-closed e limites claros de seguranca.
