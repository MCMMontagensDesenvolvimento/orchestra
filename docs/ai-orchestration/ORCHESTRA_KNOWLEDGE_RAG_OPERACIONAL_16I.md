# Orchestra Knowledge/RAG Operacional Avancado 16I

## Objetivo

A Fase 16I transforma o Knowledge/RAG do Orchestra em um fluxo operacional controlado: upload TXT/MD/CSV, parsing deterministico, ingestao local idempotente, embeddings governados opcionais, retrieval keyword/semantic/hybrid e readiness visivel para base e assistente.

O runtime continua sem retrieval livre. O Orchestra resolve o contexto, aplica tenant/workspace/bindings/policies/limites, persiste a consulta RAG e envia ao runtime somente fontes resolvidas, trechos limitados e metadados allowlistados.

## Escopo entregue

- Upload operacional em `POST /api/v1/knowledge-bases/:id/documents/upload`.
- Validacao de extensao, MIME, tamanho, UTF-8, binario e CSV malformado.
- Conteudo bruto aceito somente para persistencia do documento e chunking; audit logs usam contadores/metadados sanitizados.
- Ingestao local com chunks, source references, eventos e reingestao idempotente por `contentHash`.
- Embeddings com provider `disabled`, `openai` real opcional e `stub` deterministico offline.
- Readiness de base em `GET /api/v1/knowledge-bases/:id/readiness`.
- Readiness de assistente considerando policy `allowRuntimeRetrieval`, workspace, bindings, documentos, chunks e embeddings.
- Retrieval oficial configuravel por `keyword`, `semantic` ou `hybrid`.
- UI do Knowledge Hub com upload TXT/MD/CSV real, cadastro textual manual, readiness da base e status de embeddings por documento.

## Fora do escopo

- PDF, DOCX, XLSX e OCR.
- Retrieval livre dentro do Agno/runtime.
- Execucao de provider externo em testes automatizados.
- Upload publico anonimo.
- Armazenamento bruto em audit logs, eventos publicos, smoke scripts ou docs.

## Upload e parsing

Endpoint:

```http
POST /api/v1/knowledge-bases/:id/documents/upload
Content-Type: text/plain | text/markdown | text/csv
X-File-Name: manual-operacional.md
```

Regras:

- Extensoes aceitas por default: `txt,md,csv`.
- Limite default: `1048576` bytes.
- TXT/MD passam por normalizacao textual.
- CSV usa parser deterministico com aspas e aspas escapadas; linhas viram texto com colunas separadas por ` | `.
- Arquivos vazios, binarios, MIME incompativel, UTF-8 invalido e CSV com aspas abertas falham com `AppError` sanitizado.

## Ingestao e source references

`POST /api/v1/knowledge-documents/:id/request-ingestion` executa chunking local transacional:

- marca chunks antigos como `stale`;
- cria chunks ativos;
- recria source references;
- persiste eventos `knowledge_ingestion_started`, `knowledge_chunks_created`, `knowledge_source_references_created` e `knowledge_ingestion_completed`;
- quando o `contentHash` nao mudou e chunks/source references ativos existem, cria job `completed` com `chunksCreated=0` e evento `knowledge_ingestion_unchanged`.

## Embeddings

Defaults permanecem fail-closed:

```env
EMBEDDINGS_ENABLED=false
EMBEDDINGS_PROVIDER=disabled
EMBEDDINGS_EXECUTION_ENABLED=false
```

Provider offline para testes locais:

```env
EMBEDDINGS_ENABLED=true
EMBEDDINGS_PROVIDER=stub
EMBEDDINGS_EXECUTION_ENABLED=true
EMBEDDINGS_MODEL=stub-sha256-v1
EMBEDDINGS_DIMENSION=32
```

Provider real OpenAI permanece opcional e explicito. Nenhum teste ou smoke automatizado exige chave real.

## Retrieval

Novos controles:

```env
KNOWLEDGE_RETRIEVAL_MODE=hybrid
KNOWLEDGE_RETRIEVAL_MAX_TOP_K=5
KNOWLEDGE_RETRIEVAL_MAX_EXCERPT_CHARS=1200
KNOWLEDGE_RETRIEVAL_MAX_CONTEXT_CHARS=6000
KNOWLEDGE_RETRIEVAL_SCORE_THRESHOLD=0
```

Modos:

- `keyword`: usa busca lexical local governada.
- `semantic`: exige embeddings prontos e embeddings persistidos; falha fechado se provider/repository semantico falhar.
- `hybrid`: usa semantico quando pronto; aplica fallback keyword governado quando embeddings nao estao prontos ou nao ha resultados semanticos. Falha fechado quando a consulta vetorial/repository falha inesperadamente.

## Readiness

Base:

```http
GET /api/v1/knowledge-bases/:id/readiness
```

Retorna status `ready`, `degraded` ou `not_ready`, modo configurado/efetivo, contadores de docs/chunks/embeddings, bloqueios e resumo sanitizado de embeddings.

Assistente:

```http
GET /api/v1/assistants/:id/rag/readiness
```

Considera somente bases ativas, mesmo workspace do assistente, binding habilitado e policy `allowRuntimeRetrieval=true`. Bases bloqueadas por policy ou workspace nao entram nos candidatos.

## Runtime e citacoes

O `AgentRun` chama `queryRag` antes do runtime quando RAG governado esta habilitado. Se o retrieval falhar de modo nao recuperavel, o run falha fechado com `RUNTIME_RAG_RETRIEVAL_FAILED`.

Fontes carregam `documentTitle`, `sourceType`, `sectionTitle`, `pageNumber`, score e excerpt limitado. O contrato do runtime recebe esses detalhes somente em `metadata` allowlistada e nao recebe documento bruto.

## Validacao operacional

Comandos principais:

```bash
cd backend && npm run typecheck
cd frontend && npm run typecheck
cd backend && npm run test -- tests/unit/knowledge-upload.test.ts tests/unit/embedding-stub.test.ts --run
cd backend && npm run test -- tests/api/knowledge-mcp-catalog.test.ts --run
scripts/smoke-knowledge-rag-16i.sh --dry-run
```

O smoke 16I valida arquivos versionados, envs fail-closed, rotas, docs e testes sem carregar `.env`, sem rede e sem provider real.

## Rollback

Rollback seguro:

1. `KNOWLEDGE_RETRIEVAL_MODE=keyword` para evitar dependencia semantica.
2. `EMBEDDINGS_ENABLED=false`, `EMBEDDINGS_PROVIDER=disabled`, `EMBEDDINGS_EXECUTION_ENABLED=false`.
3. Remover bindings ou setar policy `allowRuntimeRetrieval=false` em bases sensiveis.
4. Desabilitar RAG no runtime Agno HTTP: `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false`.
5. Arquivar documentos/bases problemáticos pelo fluxo existente.

## Riscos remanescentes

- TXT/MD/CSV podem conter informacao sensivel nos excerpts; mitigacao atual e RBAC, workspace, policy, limites e ausencia de audit bruto.
- CSV parsing e propositalmente conservador; dialetos complexos devem virar backlog antes de importacao massiva.
- Embeddings reais dependem de chave e disponibilidade externa; defaults continuam desligados.
- PDF/DOCX/OCR exigem pipeline separado com anti-malware, extracao deterministica e novas validacoes.
