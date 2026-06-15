# Orchestra Agno Runtime Security

Status: implementado na Fase 07B.

## Principio

A integracao Agno local e opcional, desabilitada por padrao e subordinada ao backend Orchestra. O runtime local nao decide permissao, nao recebe secrets e nao executa tools externas diretamente nesta fase.

## Gates Antes Da Chamada

Antes de qualquer `POST` para o runtime Agno local, o backend valida:

- sessao autenticada;
- tenant e workspace;
- permissao da rota;
- assistant e versao;
- status do assistant;
- execution policy;
- precheck de execucao;
- modo sandbox quando `AGNO_REQUIRE_SANDBOX=true`;
- readiness e resumo RAG;
- bindings e policies MCP.

## Configuracao Segura

Variaveis principais:

```env
RUNTIME_PROVIDER=local
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_ENABLED=false
AGNO_EXECUTION_ENABLED=false
AGNO_REQUIRE_SANDBOX=true
AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
AGNO_SEND_RAG_CONTEXT=true
AGNO_SEND_MCP_TOOL_DESCRIPTORS=true
```

`/runtime/config` retorna apenas booleans e limites sanitizados. `AGNO_API_KEY` e `AGNO_BASE_URL` completa nao sao expostos ao frontend.

## Sanitizacao

O backend limita:

- input a hash e preview;
- output a preview e hash;
- eventos remotos a metadata sanitizada;
- RAG a excerpts curtos e citations;
- MCP a descriptors sem credenciais.

Campos com nomes relacionados a token, secret, prompt, input, output, text, content ou authorization sao redigidos em metadata de eventos remotos.

## Auditoria

AgentRun registra eventos `runtime.*` e `agno.*`. AuditLog registra resolucao do adapter, inicio, conclusao, falha ou bloqueio da execucao. Payload bruto e corpo completo de resposta nao entram em audit logs.

## Restricoes Da Fase

Mesmo com flags futuras presentes, o payload atual mantem `realExternalProvidersAllowed=false`, `remoteMcpAllowed=false` e `toolCallingEnabled=false`. MCP real continua passando pelo sandbox do Orchestra.
