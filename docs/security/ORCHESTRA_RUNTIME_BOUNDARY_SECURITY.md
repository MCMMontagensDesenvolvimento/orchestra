# Orchestra Runtime Boundary Security

Status: implementado na Fase 07A.

## Autoridade

O backend Orchestra permanece autoridade para:

- autenticacao;
- RBAC e workspace scope;
- assistant e versao;
- execution policy;
- precheck;
- RAG readiness;
- MCP sandbox policy;
- auditoria;
- persistencia de `AgentRun` e eventos.

Frontend e adapters nao decidem permissao final.

## Defaults Seguros

Defaults backend:

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_REQUIRE_PRECHECK=true
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
AGNO_ENABLED=false
AGNO_HEALTHCHECK_ENABLED=false
```

## Sanitizacao

O boundary usa:

- input hash;
- input preview limitado;
- output preview limitado;
- policy snapshot sem payload sensivel;
- resumo RAG sem conteudo bruto;
- resumo MCP sem executar tools remotas.

Nao registrar:

- secrets;
- tokens;
- API keys;
- authorization headers;
- prompts completos sensiveis;
- conteudo completo de documentos;
- payload bruto extenso.

## Auditoria

Eventos adicionados:

- `runtime_health_checked`
- `runtime_adapter_resolved`
- `runtime_execution_started`
- `runtime_execution_completed`
- `runtime_execution_failed`
- `runtime_execution_blocked`
- `runtime_adapter_misconfigured`
- `agno_adapter_readiness_checked`

Audit metadata inclui provider, status, health e ids tecnicos, sem secrets.

## Agno

O adapter Agno e somente stub/readiness nesta fase. Ele nao chama Agno real, nao exige container separado e nao deve ser usado por padrao no stack local.
