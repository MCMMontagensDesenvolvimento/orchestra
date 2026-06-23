# Orchestra - Fase 10A - Discovery RAG Semantico e Vector Store

Status: concluido como discovery tecnico inicial da Fase 10 / Sprint 13.

## Objetivo

Registrar o estado atual do RAG no Orchestra antes de alterar banco, schema, providers de embedding ou fluxo de retrieval.

A Fase 10 deve evoluir o RAG local deterministico existente para RAG semantico governado, preservando os controles ja implementados de tenancy, workspace, autorizacao, readiness, auditoria, citations e rastreabilidade.

## Estado Atual Encontrado

O backend ja possui modulo de Knowledge/RAG com:

* Knowledge Bases;
* Documents;
* Chunks textuais;
* Source References;
* Ingestion jobs/events;
* Readiness por assistant;
* Query RAG local por keyword;
* Persistencia de `RagQuery`;
* Persistencia de `RagQueryResult`;
* Citations auditaveis;
* Integracao preparada com runtime via contexto RAG.

O retrieval atual usa modo local/deterministico:

* `retrievalMode`: `local_chunks_only`;
* `mode`: `local_keyword` ou `keyword_local_placeholder`;
* `embeddingsEnabled`: `false`;
* `vectorStoreEnabled`: `false`.

## Modelo De Dados Atual

As estruturas atuais relevantes sao:

* `knowledge_bases`;
* `knowledge_documents`;
* `knowledge_chunks`;
* `knowledge_source_references`;
* `rag_queries`;
* `rag_query_results`.

Nao existe ainda tabela dedicada para embeddings, vetores, indices vetoriais ou status de embedding por chunk.

## Infraestrutura Atual Do Banco

O ambiente local usa PostgreSQL 16 via imagem:

```text
postgres:16-alpine
```

No ambiente inspecionado, a extensao `vector` nao aparece como extensao disponivel. Portanto, uma migration com `CREATE EXTENSION vector` nao deve ser criada enquanto a imagem/infraestrutura do Postgres nao for decidida.

Extensoes como `pg_trgm`, `pgcrypto` e `uuid-ossp` aparecem disponiveis, mas nao estavam instaladas no banco inspecionado.

## Decisao Tecnica Inicial

A Fase 10 nao deve substituir o RAG local existente.

A evolucao deve ser incremental:

1. preservar retrieval local como fallback governado;
2. introduzir embeddings como camada derivada dos chunks;
3. manter `RagQuery` e `RagQueryResult` como fonte auditavel de toda consulta;
4. manter citations baseadas em `KnowledgeChunk` e `KnowledgeSourceReference`;
5. ativar retrieval semantico apenas quando provider de embeddings e vector store estiverem prontos;
6. manter `embeddingsEnabled=false` e `vectorStoreEnabled=false` ate a infraestrutura estar validada.

## Decisao Proposta Para Embeddings

A opcao recomendada e criar uma tabela separada para embeddings de chunks, em vez de adicionar o vetor diretamente em `knowledge_chunks`.

Nome proposto:

```text
knowledge_chunk_embeddings
```

Motivos:

* um chunk textual pode ter embeddings de modelos diferentes;
* dimensoes podem variar por provider/modelo;
* embeddings podem ser reprocessados sem recriar o chunk;
* status de embedding pode ser controlado separadamente;
* falhas de embedding nao devem quebrar a ingestao textual;
* permite manter fallback lexical quando o semantico estiver indisponivel;
* facilita auditoria de provider, modelo, dimensao, hash e versao.

## Campos Candidatos Para A Tabela Futura

Campos candidatos para decisao na Fase 10B/10C:

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

O tipo do campo `embedding` ainda depende da decisao de vector store:

* `vector(<dimension>)` com pgvector, se a infraestrutura suportar;
* armazenamento externo, se a decisao for usar vector store dedicado;
* nenhum campo vetorial no Prisma enquanto o banco nao suportar a extensao.

## Decisoes Pendentes Para 10B

Antes de criar migration, decidir:

1. Usar pgvector no proprio Postgres ou vector store externo.
2. Se pgvector for escolhido, trocar a imagem local `postgres:16-alpine` por imagem com pgvector ou criar imagem customizada.
3. Como garantir compatibilidade do ambiente futuro de homologacao/producao.
4. Qual provider de embeddings sera o primeiro suportado.
5. Qual dimensao inicial de embedding sera usada.
6. Se o campo vetorial sera mapeado no Prisma como `Unsupported(...)` ou usado via SQL raw.
7. Como versionar reprocessamento de embeddings.
8. Como bloquear embeddings em production-like sem configuracao explicita.
9. Como manter retrieval local como fallback governado.
10. Como refletir readiness semantico no contrato existente.

## Regras Que Devem Ser Preservadas

* Frontend nao chama provider externo.
* Backend continua sendo o control plane.
* Providers externos permanecem fail-closed.
* Nenhum segredo deve ser exposto no frontend.
* Tenant/workspace/bindings continuam obrigatorios.
* Queries RAG continuam auditaveis.
* Citations continuam rastreaveis.
* Conteudo completo de documento/chunk nao deve ser gravado em audit logs.
* Retrieval semantico nao deve mascarar falha com dados falsos.
* O sistema deve continuar funcionando com retrieval local quando embeddings estiverem indisponiveis.

## Caminho Recomendado Da Fase 10

* 10A: discovery tecnico e decisao inicial.
* 10B: decisao formal de vector store e contrato de embeddings.
* 10C: schema/migration minima para embeddings.
* 10D: provider de embeddings em modo fail-closed.
* 10E: pipeline de embedding para chunks existentes.
* 10F: retrieval semantico com fallback lexical governado.
* 10G: readiness/API/frontend para estado semantico.
* 10H: smoke, testes e documentacao de fechamento da Sprint 13.

## Criterio De Aceite Da 10A

A 10A e considerada concluida quando:

* o estado atual do RAG estiver documentado;
* a ausencia de pgvector no banco atual estiver registrada;
* a decisao de nao criar migration vetorial ainda estiver registrada;
* a preferencia por tabela separada de embeddings estiver registrada;
* as decisoes pendentes para 10B estiverem claras;
* nenhuma alteracao funcional tiver sido feita.
