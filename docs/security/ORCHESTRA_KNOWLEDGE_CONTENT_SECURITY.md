# Orchestra Knowledge Content Security

Status: implementado na Fase 06B para conteudo textual simples.

## Controles

- Backend valida tenant e workspace em documentos, chunks, source references e jobs.
- `knowledge.ingestion.manage` e exigida para solicitar ingestao.
- `knowledge.read` e exigida para consultar chunks, references e readiness.
- Documento arquivado nao pode ser ingerido.
- Reingestao nao duplica chunks ativos indefinidamente: chunks anteriores viram `stale`.
- Audit logs nao gravam `contentText` bruto.
- Metadata de auditoria e sanitizada.
- JSON de catalogo continua bloqueando chaves sensiveis.

## Retencao E Classificacao

O conteudo textual simples fica persistido em `knowledge_documents.content_text` e `knowledge_chunks.content`. A classificacao de dados vem da base/documento e deve orientar controles futuros de retencao, mascaramento, DLP e exclusao.

## Limites

- Sem storage seguro para upload binario nesta fase.
- Sem parser robusto de arquivos.
- Sem embeddings ou vector store.
- Sem chamada a provider externo.
- Sem execucao MCP ou runtime externo.

## Recomendacoes Futuras

- Definir politica formal de retencao por classificacao.
- Adicionar mascaramento ou rejeicao de PII quando aplicavel.
- Mover conteudo sensivel para storage com criptografia e politicas dedicadas.
- Registrar trilhas de acesso a chunks quando retrieval real for implementado.
