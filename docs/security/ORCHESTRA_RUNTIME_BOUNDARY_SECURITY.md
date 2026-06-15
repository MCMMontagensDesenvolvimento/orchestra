# Orchestra Runtime Boundary Security

Status: implementado na Fase 07A e evoluido na Fase 07B.

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
RUNTIME_DEFAULT_TIMEOUT_MS=15000
RUNTIME_REQUIRE_PRECHECK=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
AGNO_ENABLED=false
AGNO_EXECUTION_ENABLED=false
AGNO_HEALTHCHECK_ENABLED=false
AGNO_REQUIRE_SANDBOX=true
AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
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

O adapter Agno pode chamar runtime HTTP local quando habilitado explicitamente. Ele permanece desabilitado por padrao, exige configuracao backend-only e falha fechado quando a configuracao esta incompleta, o runtime esta indisponivel, a resposta e invalida ou o sandbox obrigatorio nao e respeitado.

Mesmo com Agno habilitado, o payload nao permite providers externos reais nem MCP remoto direto nesta fase.
