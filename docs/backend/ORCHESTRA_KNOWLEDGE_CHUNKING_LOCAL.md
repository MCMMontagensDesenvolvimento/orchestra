# Orchestra Knowledge Local Chunking

Status: implementado na Fase 06B como chunking textual deterministico.

## Configuracao Atual

Valores padrao no backend:

- `chunkSizeChars`: 1200
- `chunkOverlapChars`: 150
- `maxDocumentChars`: 100000

## Algoritmo

O servico local:

- normaliza quebras de linha;
- remove espacos duplicados simples por linha;
- preserva paragrafos quando possivel;
- agrupa paragrafos ate o tamanho configurado;
- divide paragrafos longos em partes menores;
- estima tokens por aproximacao de caracteres;
- calcula `contentHash` com SHA-256;
- registra offsets simples para futuras citacoes.

## Persistencia

Cada chunk gera:

- `KnowledgeChunk` com `content`, `contentHash`, `chunkIndex`, `charCount`, `tokenEstimate` e status `active`;
- `KnowledgeSourceReference` com label, tipo de fonte, URI simples e offsets.

Reingestao marca chunks ativos anteriores como `stale` antes de criar novos chunks. Falhas antes da criacao de chunks nao apagam chunks ativos existentes; elas registram job `failed` e erro no documento.

## Limites

O chunking atual nao e semantico. Ele nao usa tokenizer real, embeddings, reranking ou vector database. O resultado e suficiente para readiness, auditoria e busca textual local controlada.
