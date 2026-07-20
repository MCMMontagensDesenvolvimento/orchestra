# Orchestra — MCP Externo Read-only Governado (Fase 16P)

Status: fundação implementada, opt-in e fail-closed. Nenhum transporte MCP produtivo é habilitado por padrão.

Evolução: a Fase 16Q conecta esta fronteira exclusivamente ao demo local fictício e read-only, mediante exceção HTTP opt-in proibida em produção. Consulte `ORCHESTRA_MCP_READONLY_INTEGRACAO_HOMOLOGADA_16Q.md`. O transporte genérico externo permanece fora de escopo.

## Objetivo

Estabelecer o primeiro caminho governado para uma tool MCP externa de leitura, risco baixo e sem aprovação pendente. A fase entrega validação de egress, contrato de client injetável, revalidação no gateway, auditoria e observabilidade, preservando os defaults desligados.

## Escopo

- readiness e discovery controlados por flags;
- execução remota exclusivamente read-only pelo gateway;
- allowlist explícita de origens HTTPS e proteção contra SSRF;
- referência lógica de credencial, sem resolução de secret real;
- transporte fake/injetável para testes;
- persistência de hashes, status e metadata operacional sanitizada;
- UI honesta sobre o estado da fundação e analytics com fallback.

## Fora de escopo

- transporte MCP produtivo homologado ou chamada externa real nesta entrega;
- tool de escrita, mutation, side effect, shell ou comando;
- risco médio/alto/crítico e approval humano pendente;
- secret manager, rotação ou revogação pela UI;
- discovery/health simulados na UI;
- deploy, migration ou mudança no schema Prisma;
- alteração de Chat, RAG, Response Scope, provider externo ou `maxToolCalls` default.

## Arquitetura

```text
Agno/runtime
  -> Orchestra tool gateway
     -> revalida run + spec + descriptor + binding + tool + policy
     -> exige flags + readOnly + low risk + sem approval + allowRuntimeExecution
     -> McpRemoteClient
        -> valida secretRef lógico
        -> normaliza URL e valida allowlist/DNS/SSRF
        -> transporte injetado executeReadonlyTool
     -> persiste hash/status/metadata segura
     -> retorna conteúdo minimizado ao runtime
```

O Agno nunca recebe URL, headers, auth ou `secretRef`. O transporte default do client é `FailClosedMcpRemoteClientTransport` e retorna `MCP_REMOTE_NOT_IMPLEMENTED`. Portanto, o código de produção permanece bloqueado até existir um transporte aprovado e explicitamente conectado.

## Flags

| Flag | Default | Função |
| --- | --- | --- |
| `MCP_REMOTE_ENABLED` | `false` | gate mestre existente |
| `MCP_REMOTE_DISCOVERY_ENABLED` | `false` | habilita discovery governado |
| `MCP_REMOTE_EXECUTION_ENABLED` | `false` | habilita avaliação de execução |
| `MCP_REMOTE_READONLY_ENABLED` | `false` | restringe execução ao perfil read-only |
| `MCP_REMOTE_EGRESS_ALLOWLIST` | vazio | lista de origens HTTPS separadas por vírgula |
| `MCP_REMOTE_DEFAULT_TIMEOUT_MS` | `5000` | timeout operacional default |
| `MCP_REMOTE_MAX_TIMEOUT_MS` | `5000` | teto de timeout do client |
| `MCP_REMOTE_MAX_RESPONSE_BYTES` | `65536` | teto seguro de resposta |
| `MCP_REMOTE_REQUIRE_SECRET_REF` | `true` | exige referência lógica quando há auth |
| `MCP_REMOTE_ALLOW_WRITE_TOOLS` | `false` | deve permanecer falso; verdadeiro também bloqueia a fundação |

Habilitar uma flag isoladamente nunca autoriza uma chamada. Todos os gates precisam passar.

## Egress allowlist

A allowlist aceita somente origens, por exemplo `https://mcp.exemplo.corp` ou `https://mcp.exemplo.corp:8443`. Paths pertencem à `baseUrl` cadastrada, não à entrada de allowlist.

Antes do transporte, o backend:

1. exige HTTPS;
2. rejeita usuário/senha, query strings e fragments embutidos;
3. normaliza host, porta e origin;
4. exige correspondência exata na allowlist;
5. resolve o host;
6. rejeita localhost, metadata, loopback, private, link-local, ULA, multicast e endereços reservados selecionados.

Uma resposta DNS vazia, erro de resolução ou qualquer endereço bloqueado falha fechado com `MCP_REMOTE_EGRESS_BLOCKED`. O motivo é genérico e não inclui header, credencial ou payload.

## SecretRef

`secretRef`/`credentialRef` representa somente um identificador lógico, como `vault://orchestra/mcp/consulta`. O backend valida formato e comprimento; requests com `token`, `apiKey`, senha, authorization ou campos extras são rejeitados. DTOs públicos retornam somente `credentialConfigured: boolean`.

Esta fase não resolve o valor no cofre. Um transporte futuro poderá receber a referência por uma interface interna, mas jamais deve persistir ou logar o valor resolvido.

## Policy, risco e approval

Para executar, todos os itens abaixo são obrigatórios:

- server e tool ativos, não arquivados, e server confiável;
- run publicado; sandbox continua bloqueando tools externas;
- binding ativo em `enabled_placeholder` para o caminho remoto;
- descriptor presente na spec do run e schema ainda idêntico ao catálogo;
- `readOnly: true` em metadata da tool;
- tool, descriptor e server com risco baixo;
- `allowRuntimeExecution: true`, `sandboxOnly: false`, `blockedByDefault: false`;
- nenhuma exigência de approval no descriptor, tool, policy ou binding;
- todas as flags remotas/read-only habilitadas;
- `MCP_REMOTE_ALLOW_WRITE_TOOLS=false`;
- referência lógica presente quando auth não é `none`;
- origem allowlisted e resolução pública.

Também são bloqueados nomes, descrições ou schemas que indiquem `create`, `update`, `delete`, `remove`, `write`, `post`, `put`, `patch`, `drop`, `truncate`, `send`, `transfer`, `approve`, `execute`, `shell` ou `command`.

## Fluxo gateway para MCP client

O gateway serializa chamadas por run, aplica idempotência por `toolCallId`, valida sequência e `maxToolCalls`, reconsulta o estado atual e somente então cria o client. Um bloqueio anterior não instancia nem chama o client.

No sucesso controlado, o registro `McpToolCall` usa `mode=remote_controlled`, guarda `inputHash` e metadata segura, sem `inputPreview`/`outputPreview`. `externalMcpCalled=true` é produzido somente depois de `executeReadonlyTool` retornar. Um fake continua com `simulated=true`.

## Matriz permitido e bloqueado

| Cenário | Resultado |
| --- | --- |
| defaults ou qualquer gate remoto desligado | bloqueado, client não chamado |
| host ausente da allowlist ou resolução privada | `MCP_REMOTE_EGRESS_BLOCKED` |
| auth sem referência lógica | `MCP_REMOTE_SECRET_REF_REQUIRED` |
| tool sem `readOnly=true` | `MCP_REMOTE_TOOL_NOT_READONLY` |
| verbo perigoso detectado | `MCP_REMOTE_TOOL_OPERATION_BLOCKED` |
| risco diferente de baixo ou approval requerido | bloqueado por policy |
| policy sandbox/default-block/sem runtime | bloqueado por policy |
| run em modo sandbox | bloqueado antes de criar/chamar o client |
| todos os gates + fake injetado | permitido, `externalMcpCalled=true`, `simulated=true` |
| todos os gates + transporte default | `MCP_REMOTE_NOT_IMPLEMENTED`, fail-closed |

## Campos allowlistados

- `mcpRemoteEvaluationApplied`
- `mcpRemoteAllowed`
- `mcpRemoteBlocked`
- `mcpRemoteBlockedReason`
- `mcpRemoteReadOnly`
- `mcpRemoteHost`
- `mcpRemoteToolId`
- `mcpRemoteRiskLevel`
- `externalMcpCalled`
- `simulated`
- `latencyMs`
- `responseBytes`
- `toolCallsExecuted`, IDs técnicos, status e hashes já governados

## Campos proibidos

- argumentos e payload bruto da tool;
- resposta externa completa em log/audit/persistência;
- headers, cookies, authorization e material de autenticação;
- token, API key, senha ou secret resolvido;
- `secretRef` em DTO público, analytics, evento ou audit;
- URL com credencial, stack trace e configuração interna do server no runtime.

## Validação manual

1. Execute `scripts/smoke-mcp-externo-readonly-16p.sh --dry-run`.
2. Confirme os smokes 16O/16N/16M/16K/16I e typechecks.
3. Mantenha todas as flags remotas falsas no primeiro deploy.
4. Em homologação isolada, cadastre somente uma origem HTTPS aprovada e uma tool de consulta low-risk.
5. Configure apenas uma referência lógica; não capture seu valor em evidência.
6. Conecte exclusivamente um transporte homologado e com revisão de segurança.
7. Faça um caso bloqueado antes do permitido e confirme `externalMcpCalled=false` no bloqueio.
8. No caso permitido, confira `readOnly=true`, host esperado, status e tamanho, sem args/output em audit.

## Consultas SQL e auditoria

Use apenas IDs e metadata operacional; nunca selecione `secret_ref` para evidência:

```sql
SELECT id, mode, status, mcp_server_id, mcp_tool_id, request_id, trace_id,
       input_hash, duration_ms, metadata, created_at
FROM mcp_tool_calls
WHERE mode = 'remote_controlled'
ORDER BY created_at DESC
LIMIT 50;
```

```sql
SELECT action, entity, entity_id, request_id, metadata, created_at
FROM audit_logs
WHERE action IN (
  'runtime_tool_gateway_mcp_remote_readonly_executed',
  'runtime_tool_gateway_blocked'
)
ORDER BY created_at DESC
LIMIT 100;
```

Antes de compartilhar resultados, confirme a ausência de args, output, headers, auth, token, API key, senha e referências internas de cofre.

## Rollback

Rollback imediato e sem migration:

1. defina `MCP_REMOTE_EXECUTION_ENABLED=false`;
2. defina `MCP_REMOTE_READONLY_ENABLED=false`;
3. esvazie `MCP_REMOTE_EGRESS_ALLOWLIST`;
4. se necessário, defina `MCP_REMOTE_ENABLED=false` e desabilite tool gateway/tools no Agno;
5. reinicie somente os serviços de aplicação segundo o runbook 16O;
6. confirme bloqueios com `externalMcpCalled=false` e revise eventos/audit por IDs técnicos.

Não há migration para reverter. Registros históricos permanecem para auditoria.

## Incidentes

- Suspeita de side effect ou destino indevido: desligue os gates e esvazie a allowlist antes de investigar.
- Suspeita de vazamento: preserve IDs/timestamps, não copie payloads e acione o processo de segredo no cofre externo.
- DNS/SSRF bloqueado: mantenha fail-closed; não adicione IP privado como exceção.
- Timeout/resposta excessiva: mantenha limites, marque o transporte indisponível e não faça retry irrestrito.

## Riscos remanescentes

- ainda não há transporte MCP produtivo nem resolução de secret manager;
- a classificação read-only combina marcação explícita e heurística, não prova ausência de side effects no servidor remoto;
- DNS pode mudar entre validação e conexão em um transporte futuro; esse transporte deve fixar/validar o destino efetivamente conectado;
- rate limit/concurrency específicos por destino ainda dependem da evolução operacional;
- homologação real exige threat model, contrato do fornecedor, observabilidade e resposta a incidente aprovados.
