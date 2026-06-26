# AI Orchestration

Status: preparado. A Fase 06 criou catalogo governado de Knowledge/RAG/MCP, a Fase 06B adicionou readiness local com chunks textuais, a Fase 06C adicionou query RAG local com citations, a Fase 06D adicionou MCP execution sandbox, a Fase 07A adicionou Runtime Adapter Boundary, a Fase 07B adicionou Agno local runtime opcional, a Fase 07C adicionou LLM Provider Integration controlada, a Fase 11A documenta discovery/contrato para MCP remoto real governado, a Fase 11B adiciona a base backend fail-closed de readiness/client stub MCP remoto, a Fase 11C adiciona discovery remoto governado com transporte injetavel, sanitizacao, diff e policy bloqueada por default, a Fase 11D adiciona review package/audit/approval gate para discovery remoto sem importar tools no catalogo e a Fase 11E adiciona import plan governado para catalogo como draft nao aplicavel. Runtime produtivo de IA, MCP externo real, tool calls produtivos fora do sandbox e integracao Agno/AgentOS produtiva continuam fora do escopo ate as proximas subfases.

Esta pasta deve concentrar a estrategia de IA do Orchestra.

Topicos esperados:

- Runtime de assistentes.
- Providers de modelos.
- RAG.
- MCP.
- Tool calls.
- Guardrails.
- Avaliacao e auditoria de respostas.

## Documentos

- `ORCHESTRA_RAG_READINESS_HANDOFF.md`: readiness local, busca textual em chunks autorizados e handoff para RAG semantico futuro.
- `ORCHESTRA_RAG_RETRIEVAL_CONTRACT_HANDOFF.md`: contrato de retrieval local, citations, queryId e handoff para runtime futuro.
- `ORCHESTRA_MCP_EXECUTION_HANDOFF.md`: contrato de precheck/tool call sandbox, eventos e handoff para executor MCP futuro.
- `ORCHESTRA_MCP_REMOTO_DISCOVERY_11A.md`: discovery tecnico do MCP atual, gaps e contrato governado para MCP remoto real sem execucao externa nesta subfase.
- `ORCHESTRA_MCP_REMOTO_READINESS_FAIL_CLOSED_11B.md`: contratos backend, flags fail-closed, client stub e readiness estrutural para MCP remoto sem chamada externa real.
- `ORCHESTRA_MCP_REMOTO_DISCOVERY_GOVERNADO_11C.md`: discovery remoto governado backend-only, com transporte injetavel, sanitizacao, specHash, diff e default policy bloqueada.
- `ORCHESTRA_MCP_REMOTO_DISCOVERY_AUDIT_APPROVAL_11D.md`: review package, snapshot/hash, proposed actions, audit event sanitizado e approval gate para discovery remoto sem import automatico.
- `ORCHESTRA_MCP_REMOTO_CATALOG_IMPORT_PLAN_11E.md`: plano governado de importacao/reconciliacao para catalogo MCP remoto, com operations draft, validation/preflight e audit event sanitizado sem aplicar alteracoes.
- `ORCHESTRA_AGNO_READINESS_HANDOFF.md`: stub/readiness Agno, flags e caminho para integracao futura.
- `ORCHESTRA_RUNTIME_ADAPTER_HANDOFF.md`: boundary de runtime, resumos RAG/MCP e eventos normalizados.
- `ORCHESTRA_AGNO_LOCAL_RUNTIME_HANDOFF.md`: handoff da integracao HTTP local Agno-compatible e mock runtime.
- `ORCHESTRA_LLM_PROVIDER_INTEGRATION.md`: catalogo LLM, provider local deterministico, providers externos fail-closed e eventos LLM em AgentRun.
- `ORCHESTRA_RAG_SEMANTICO_DISCOVERY.md`: discovery tecnico da Fase 10A para RAG semantico, embeddings e vector store.
- `ORCHESTRA_VECTOR_STORE_EMBEDDING_CONTRACT.md`: decisao tecnica da Fase 10B para pgvector, tabela de embeddings, readiness semantico e fail-closed.
- `ORCHESTRA_EMBEDDINGS_FAIL_CLOSED_10D.md`: base backend-only de embeddings em modo fail-closed, sem provider externo e com readiness integrada ao RAG local.
- `ORCHESTRA_EMBEDDINGS_PROVIDER_GOVERNADO_10E.md`: adapter estrutural OpenAI para embeddings governados, com readiness diferenciada e execucao externa ainda bloqueada.
- `ORCHESTRA_EMBEDDINGS_EXECUTION_OPENAI_10F.md`: execucao OpenAI controlada para embeddings no backend, com cliente HTTP injetavel, limites e testes sem internet.
- `ORCHESTRA_EMBEDDINGS_PERSISTENCIA_CONTROLADA_10G.md`: persistencia controlada e idempotente de embeddings em `knowledge_chunk_embeddings`, sem ativar vector search no RAG.
- `ORCHESTRA_RAG_RETRIEVAL_SEMANTICO_10H.md`: endpoint backend-only para retrieval semantico com pgvector e fallback lexical, sem alterar o `queryRag` oficial.
- `ORCHESTRA_RAG_QUERY_SEMANTICA_OFICIAL_10I.md`: integracao do retrieval semantico ao `queryRag` oficial, com persistencia em `RagQuery`, citations, auditoria e fallback lexical controlado.
- `ORCHESTRA_RAG_SEMANTICO_FECHAMENTO_SPRINT13_10J.md`: fechamento tecnico da Sprint 13, criterios de aceite, smoke operacional, riscos, rollback e proximas fases para RAG semantico.
