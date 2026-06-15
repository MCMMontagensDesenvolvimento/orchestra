# Orchestra LLM Provider Security

Status: implementado na Fase 07C.

## Principios

- Backend e a autoridade de configuracao e execucao.
- Frontend nunca recebe API keys, tokens, headers ou endpoints sensiveis.
- Providers externos sao opt-in e permanecem fail-closed.
- Prompt e output bruto nao sao armazenados por padrao.
- Auditoria recebe hashes, flags e tamanhos, nao payload bruto.
- AgentRun continua exigindo precheck e RuntimeAdapter.

## Sanitizacao

`GET /api/v1/llm/config` retorna apenas flags booleanas, limites numericos e metadados seguros.

`GET /api/v1/llm/providers` retorna:

- status;
- capabilities;
- flags `enabled`, `configured`, `executionEnabled`;
- `secretsConfigured` como booleano;
- modelos sanitizados quando configurados.

Nao retorna:

- API keys;
- authorization headers;
- tokens;
- endpoint Azure;
- prompt completo;
- output completo;
- request ou response brutos.

## Execucao Externa

OpenAI, Azure OpenAI e Anthropic existem como wrappers planejados e bloqueados. Mesmo se configurados, a geracao externa nao e chamada nesta fase.

O endpoint `POST /api/v1/llm/test-generation`:

- executa `local_deterministic`;
- bloqueia provider externo desabilitado com `409`;
- limita input;
- nao registra prompt bruto;
- nao faz tool calling;
- nao chama MCP externo.

## Auditoria

Acoes administrativas registradas:

- `llm_providers_listed`;
- `llm_provider_read`;
- `llm_provider_health_checked`;
- `llm_provider_capabilities_read`;
- `llm_test_generation_completed`;
- `llm_test_generation_blocked`.

Metadados sao sanitizados por chaves sensiveis e truncamento.
