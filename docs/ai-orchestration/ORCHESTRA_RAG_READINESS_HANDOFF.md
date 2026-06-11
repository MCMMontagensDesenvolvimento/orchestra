# Orchestra RAG Readiness Handoff

Status: implementado na Fase 06B como readiness local para RAG futuro.

## Estado Atual

O Orchestra agora consegue verificar se um assistant possui Knowledge Bases vinculadas, documentos ingeridos e chunks ativos. A busca local e apenas textual por keyword em chunks autorizados.

## Contrato Atual

- `retrievalMode`: `local_chunks_only`
- `embeddingsEnabled`: `false`
- `vectorStoreEnabled`: `false`
- `mode` da busca local: `keyword_local_placeholder`

## O Que Ja Esta Pronto

- Bindings assistant para Knowledge Bases.
- Chunks persistidos por tenant/workspace/documento.
- Source references com offsets simples.
- Job events para ingestao.
- Readiness com requisitos ausentes.
- Busca textual local autorizada.

## O Que Falta Para RAG Semantico

- Definir provider de embeddings.
- Definir vector store.
- Criar tabela ou storage para vetores.
- Criar worker de ingestao e reprocessamento.
- Implementar retrieval semantico, reranking e citacoes em runtime.
- Conectar runtime de IA autorizado ao control plane.

## Regra De Integracao Futura

O runtime futuro deve receber somente contexto autorizado pelo backend. Permissao, tenancy, workspace, bindings, auditoria e politicas permanecem responsabilidade do Orchestra control plane.
