# Fixtures E2E da Fase 16R

Este diretorio contem somente dados ficticios para a homologacao local de Chat/AgentRun, RAG e MCP read-only.

- `catalogo-ficticio.md`: politica e FAQ usadas pelo retrieval governado.
- `runtime-proxy.mjs`: harness opt-in que encaminha o spec ao Agno stub e chama exatamente uma tool read-only pelo gateway enquanto o AgentRun esta ativo.
- os identificadores criados pela API ficam fora do repositorio, por padrao em `/tmp/orchestra-e2e-16r-<uid>.state`;
- nenhuma fixture contem dado corporativo, credencial, URL corporativa ou operacao de escrita.

O script `scripts/homologacao-e2e-chat-rag-mcp-16r.sh` e a unica entrada operacional suportada.
