# Orchestra - Fase 10B - Vector Store e Contrato de Embeddings

Status: proposta tecnica da Fase 10B / Sprint 13.

## Objetivo

Definir a decisao tecnica inicial para vector store, contrato de embeddings e regras de ativacao do RAG semantico no Orchestra.

Esta fase nao implementa migration, provider de embeddings, chamada externa, pgvector, worker, endpoint novo ou alteracao funcional. O objetivo e estabilizar a decisao antes da Fase 10C.

## Contexto

A Fase 10A confirmou que o Orchestra ja possui:

* Knowledge Bases;
* Documents;
* Chunks textuais;
* Source References;
* Readiness por assistant;
* Query RAG local por keyword;
* Persistencia de `RagQuery`;
* Persistencia de `RagQueryResult`;
* Citations auditaveis;
* Runtime preparado para receber contexto RAG.

Tambem confirmou que ainda nao existe:

* tabela de embeddings;
* provider de embeddings;
* vector store;
* pgvector disponivel no banco local atual;
* retrieval semantico real.

## Decisao Principal

Para o MVP, o vector store recomendado e:

```text
pgvector no PostgreSQL
```

A decisao considera que o Orchestra ja usa PostgreSQL como banco principal e que os dados de Knowledge, chunks, queries e resultados RAG ja estao modelados no mesmo contexto transacional.

## Justificativa

Usar pgvector no PostgreSQL como caminho inicial reduz complexidade operacional no MVP porque:

* evita introduzir um servico externo adicional logo no inicio;
* mantem tenant, workspace, chunks, embeddings e auditoria no mesmo banco;
* facilita rollback e troubleshooting local;
* simplifica backup/restauracao em ambiente inicial;
* permite evoluir para vector store externo depois, se necessario;
* preserva `RagQuery` e `RagQueryResult` como fonte auditavel;
* permite manter fallback lexical local quando o semantico estiver indisponivel.

## Restricao Importante

A decisao por pgvector nao significa que a migration deve ser criada imediatamente.

A Fase 10A confirmou que o ambiente local atual usa:

```text
postgres:16-alpine
```

Nesse ambiente, a extensao `vector` nao aparece como disponivel. Portanto, a Fase 10C deve primeiro decidir como disponibilizar pgvector no ambiente local e futuro ambiente de homologacao/producao.

## Alternativas Consideradas

### 1. pgvector no PostgreSQL

Status: recomendado para MVP.

Vantagens:

* menor complexidade operacional;
* aderente ao banco atual;
* bom suficiente para MVP e piloto;
* facilita auditoria e governanca;
* reduz dependencia externa.

Riscos:

* exige imagem PostgreSQL com pgvector ou imagem customizada;
* exige cuidado em migrations;
* exige validacao de performance com volume real;
* pode demandar tuning de indice vetorial no futuro.

### 2. Vector store externo

Status: nao recomendado para o primeiro incremento do MVP.

Exemplos possiveis em fase futura:

* Qdrant;
* Weaviate;
* Milvus;
* Pinecone;
* Azure AI Search;
* OpenSearch vector.

Vantagens:

* escalabilidade e recursos especializados;
* separacao de carga;
* recursos avancados de busca vetorial.

Riscos:

* aumenta superficie operacional;
* exige novas credenciais;
* aumenta complexidade de tenancy;
* exige governanca adicional;
* aumenta custo e dependencia externa.

### 3. Abstracao hibrida

Status: recomendado como diretriz de arquitetura, mas nao como implementacao imediata.

O backend deve ser desenhado para permitir troca futura de vector store sem expor essa decisao ao frontend.

## Decisao Sobre Tabela De Embeddings

A Fase 10B confirma a decisao de criar embeddings em tabela separada de `knowledge_chunks`.

Nome recomendado:

```text
knowledge_chunk_embeddings
```

## Justificativa Da Tabela Separada

Embeddings devem ser tratados como artefatos derivados dos chunks, e nao como parte do chunk original.

A separacao permite:

* gerar embeddings de modelos diferentes;
* trocar dimensao sem recriar chunks;
* reprocessar embeddings quando o conteudo ou modelo mudar;
* controlar status de embedding por chunk;
* registrar falhas sem quebrar a ingestao textual;
* manter fallback lexical quando embeddings nao existirem;
* auditar provider, modelo, dimensao e versao;
* invalidar embeddings por `content_hash`.

## Contrato Conceitual De Embedding

Cada embedding deve representar um chunk textual especifico.

Campos recomendados para a futura tabela:

* `id`;
* `tenant_id`;
* `workspace_id`;
* `knowledge_base_id`;
* `document_id`;
* `chunk_id`;
* `provider`;
* `model`;
* `dimension`;
* `embedding`;
* `content_hash`;
* `embedding_hash`;
* `status`;
* `error_code`;
* `error_message`;
* `embedded_at`;
* `metadata`;
* `created_at`;
* `updated_at`.

## Status Esperados

Status recomendados:

* `pending`;
* `processing`;
* `ready`;
* `failed`;
* `stale`;
* `disabled`.

## Regras De Unicidade

A regra recomendada para evitar duplicidade e permitir reprocessamento controlado:

```text
chunk_id + provider + model + dimension + content_hash
```

Isso permite que o mesmo chunk tenha embeddings diferentes para modelos diferentes, mas evita duplicidade acidental para o mesmo conteudo/modelo.

## Regras De Ativacao

O retrieval semantico deve ser ativado somente quando todas as condicoes forem verdadeiras:

* backend com provider de embeddings configurado;
* vector store disponivel;
* tabela/migration aplicada;
* chunks com embeddings `ready`;
* assistant com Knowledge Bases ativas e vinculadas;
* documentos ingeridos;
* usuario autorizado;
* tenant/workspace validos;
* ambiente explicitamente configurado;
* modo semantico habilitado por flag backend-only.

Caso qualquer condicao falhe, o sistema deve permanecer em fallback governado:

```text
local_keyword
```

## Flags Futuras Recomendadas

Flags candidatas para fases 10C/10D:

* `RAG_SEMANTIC_ENABLED`;
* `RAG_VECTOR_STORE_PROVIDER`;
* `RAG_EMBEDDINGS_PROVIDER`;
* `RAG_EMBEDDINGS_MODEL`;
* `RAG_EMBEDDINGS_DIMENSION`;
* `RAG_SEMANTIC_FALLBACK_ENABLED`;
* `RAG_SEMANTIC_MAX_RESULTS`;
* `RAG_SEMANTIC_MIN_SCORE`;
* `RAG_SEMANTIC_REINDEX_ENABLED`.

Nenhuma dessas flags deve ser usada pelo frontend.

## Regras De Fail-Closed

O sistema deve falhar fechado quando:

* `RAG_SEMANTIC_ENABLED=true`, mas vector store nao estiver disponivel;
* provider de embeddings estiver habilitado sem credencial valida;
* dimensao configurada nao bater com a tabela/indice;
* migration vetorial nao tiver sido aplicada;
* ambiente production-like tentar usar provider nao aprovado;
* embeddings estiverem ausentes, stale ou failed para todos os chunks elegiveis.

Falhar fechado nao significa quebrar o RAG inteiro. Significa bloquear o modo semantico e continuar, quando permitido, com fallback lexical governado.

## Contrato De Readiness Futuro

O readiness atual deve ser preservado e estendido.

Campos atuais preservados:

* `ready`;
* `knowledgeBaseCount`;
* `documentCount`;
* `chunkCount`;
* `sourceReferenceCount`;
* `enabledBindingCount`;
* `blockedReasons`;
* `warnings`;
* `retrievalMode`;
* `embeddingsEnabled`;
* `vectorStoreEnabled`.

Campos futuros candidatos:

* `semanticReady`;
* `embeddingProvider`;
* `embeddingModel`;
* `embeddingDimension`;
* `embeddedChunkCount`;
* `staleEmbeddingCount`;
* `failedEmbeddingCount`;
* `vectorIndexReady`;
* `semanticBlockedReasons`;
* `semanticWarnings`.

## Contrato De Query Futuro

O endpoint atual de query RAG deve preservar compatibilidade.

Modos esperados:

* `local_keyword`;
* `local_readiness`;
* `semantic_vector`;
* `semantic_fallback_keyword`;
* `semantic_unavailable`.

`RagQuery.mode` deve indicar o modo efetivamente usado.

`RagQueryResult.matchType` deve indicar a origem do match, por exemplo:

* `content`;
* `metadata`;
* `mixed`;
* `semantic`;
* `semantic_keyword_hybrid`.

## Auditoria

Eventos atuais devem ser preservados:

* `rag_query_requested`;
* `rag_query_completed`;
* `rag_query_no_results`;
* `rag_query_blocked`;
* `rag_query_failed`;
* `rag_source_returned`.

Eventos futuros candidatos:

* `rag_embedding_requested`;
* `rag_embedding_completed`;
* `rag_embedding_failed`;
* `rag_semantic_query_executed`;
* `rag_semantic_fallback_used`;
* `rag_vector_store_unavailable`.

Auditoria nao deve gravar:

* vetor completo;
* segredo de provider;
* documento completo;
* chunk completo;
* prompt completo;
* resposta completa de provider externo.

## Fronteira Com Frontend

O frontend nao deve:

* chamar provider de embeddings;
* enviar segredo;
* conhecer credencial;
* decidir provider;
* executar busca vetorial;
* acessar vector store diretamente.

O frontend pode:

* exibir readiness semantico;
* exibir se retrieval usado foi lexical ou semantico;
* exibir warnings;
* exibir citations;
* exibir fontes retornadas;
* exibir estado de indisponibilidade semantica.

## Fora Do Escopo Da 10B

Esta fase nao implementa:

* migration;
* pgvector;
* provider de embeddings;
* worker de embedding;
* reindexacao;
* endpoint novo;
* busca semantica;
* alteracao funcional no runtime;
* alteracao funcional no frontend;
* secrets;
* integracao externa.

## Decisao Para A 10C

A proxima fase deve decidir e implementar, de forma pequena e controlada:

1. como disponibilizar pgvector no ambiente local;
2. se a imagem do Postgres sera trocada ou customizada;
3. migration minima para tabela `knowledge_chunk_embeddings`;
4. estrategia de Prisma para campo vetorial;
5. validacao fail-closed quando pgvector nao estiver disponivel.

## Criterio De Aceite Da 10B

A 10B e considerada concluida quando:

* a decisao por pgvector no MVP estiver documentada;
* a tabela separada de embeddings estiver confirmada;
* o contrato conceitual de embeddings estiver definido;
* as regras de readiness, query, auditoria e fail-closed estiverem registradas;
* o frontend permanecer fora da execucao de embeddings/vector store;
* nenhuma alteracao funcional tiver sido feita.
