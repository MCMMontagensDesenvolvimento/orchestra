# Orchestra — MCP Read-only: Integração Homologada (Fase 16Q)

Status: integração local controlada implementada, opt-in e fail-closed. Produção continua desabilitada por padrão.

## Objetivo

Homologar a primeira chamada MCP/HTTP concreta do Orchestra sem conectar qualquer sistema real. A integração usa um servidor local versionado, dados fictícios e duas operações estritamente de leitura para validar egress, readiness, discovery, gateway, auditoria e observabilidade ponta a ponta.

## Escopo

- servidor `runtime/mcp-readonly-demo` sem banco, segredo ou rede externa;
- health, readiness e discovery por HTTP;
- tools `catalog.search` e `catalog.get_status`;
- transporte backend HTTP real limitado à origem exata do demo;
- exceção HTTP local opt-in, proibida em produção;
- execução somente por run publicado e gateway governado;
- frontend para consultar readiness/discovery seguros;
- analytics com distinção entre chamada real e fake;
- testes locais e smoke estático offline.

## Fora de escopo

- Slack, Gmail, Drive, ERP, banco corporativo ou conector de terceiros;
- secret real, API key, token, OAuth ou resolução de `secretRef`;
- mutation, upload, mensagem, aprovação, shell, comando ou tool de escrita;
- transporte MCP genérico para destinos externos;
- deploy produtivo ou habilitação automática;
- migration ou alteração do schema Prisma;
- mudança de semântica de Chat, RAG, Response Scope ou AgentRun.

## Arquitetura da integração demo

```text
UI MCP
  -> GET /mcp/servers/:id/remote-readiness
  -> GET /mcp/servers/:id/remote-discovery
       -> flags + server/policy + allowlist + egress guard
       -> McpReadonlyDemoHttpTransport
       -> http://mcp-readonly-demo:8092
          -> GET /health
          -> GET /ready
          -> GET /v1/catalog

Agno/runtime -> Orchestra tool gateway
  -> revalida run publicado + spec + tool + binding + policy
  -> exige readOnly=true + low risk + sem approval
  -> McpRemoteClient -> egress guard -> demo HTTP
  -> POST /v1/tools/call somente para catalog.search/catalog.get_status
  -> persiste hash, status e metadata segura; não persiste args/output
```

O `POST` existe apenas no canal local para transportar uma consulta read-only. O servidor rejeita qualquer nome fora da allowlist de duas tools e não possui rota de mutation.

## Servidor demo

O pacote não possui dependências npm externas. Os dados fictícios ficam em `runtime/mcp-readonly-demo/catalog.js`.

Endpoints:

| Método | Endpoint | Resultado |
| --- | --- | --- |
| `GET` | `/health` | processo saudável |
| `GET` | `/ready` | contrato read-only pronto |
| `GET` | `/v1/catalog` | catálogo fixo e fictício |
| `POST` | `/v1/tools/call` | execução das duas consultas allowlistadas |

O servidor limita body a 8192 bytes por default, aplica timeout de 5000 ms, rejeita query/fragment e registra somente método, path, status, duração e request ID técnico. Nunca registra body ou output.

## Como subir o demo

Teste o pacote isoladamente:

```bash
npm --prefix runtime/mcp-readonly-demo test
npm --prefix runtime/mcp-readonly-demo start
```

Para subir pelo Compose com profile opt-in e backend ainda bloqueado:

```bash
docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  --profile mcp-demo up --build mcp-readonly-demo
```

Para homologar readiness/discovery com o backend no mesmo Compose, passe todas as autorizações explicitamente:

```bash
MCP_REMOTE_ENABLED=true \
MCP_REMOTE_DISCOVERY_ENABLED=true \
MCP_REMOTE_EXECUTION_ENABLED=true \
MCP_REMOTE_READONLY_ENABLED=true \
MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO=true \
MCP_REMOTE_LOCAL_DEMO_ORIGIN=http://mcp-readonly-demo:8092 \
MCP_REMOTE_EGRESS_ALLOWLIST=http://mcp-readonly-demo:8092 \
docker compose \
  -f docker-compose.dev.yml \
  -f docker-compose.mcp-readonly-demo.yml \
  --profile mcp-demo up --build
```

Sem `--profile mcp-demo`, o serviço demo não sobe. Sem as flags, o backend retorna bloqueio fail-closed mesmo que o container esteja saudável.

## Flags e envs necessárias

| Variável | Default | Uso |
| --- | --- | --- |
| `MCP_REMOTE_ENABLED` | `false` | gate mestre |
| `MCP_REMOTE_DISCOVERY_ENABLED` | `false` | autoriza discovery |
| `MCP_REMOTE_EXECUTION_ENABLED` | `false` | autoriza avaliação de execução |
| `MCP_REMOTE_READONLY_ENABLED` | `false` | exige perfil read-only |
| `MCP_REMOTE_EGRESS_ALLOWLIST` | vazio | exige origem exata |
| `MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO` | `false` | permite HTTP somente para o demo local |
| `MCP_REMOTE_LOCAL_DEMO_ORIGIN` | não configurado no runtime produtivo | origem única aceita pelo transporte demo |
| `MCP_REMOTE_DEFAULT_TIMEOUT_MS` | `5000` | timeout operacional |
| `MCP_REMOTE_MAX_TIMEOUT_MS` | `5000` | teto de timeout |
| `MCP_REMOTE_MAX_RESPONSE_BYTES` | `65536` | teto da resposta HTTP |
| `MCP_REMOTE_REQUIRE_SECRET_REF` | `true` | preserva contrato para auth futura |
| `MCP_REMOTE_ALLOW_WRITE_TOOLS` | `false` | deve permanecer falso |

`MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO=true` com `NODE_ENV=production` impede o backend de iniciar. A validação de egress repete essa proteção mesmo quando recebe configuração injetada em teste.

## Allowlist e SSRF

O modo normal continua aceitando apenas HTTPS e IPs públicos. A exceção local exige simultaneamente:

1. ambiente diferente de production;
2. `MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO=true`;
3. `MCP_REMOTE_LOCAL_DEMO_ORIGIN` sem credenciais, path, query ou fragment;
4. host `mcp-readonly-demo`, `localhost`, `127.0.0.1` ou `::1`;
5. correspondência exata em `MCP_REMOTE_EGRESS_ALLOWLIST`;
6. correspondência exata novamente dentro do transporte HTTP.

Hosts privados genéricos, metadata services, `.local`, origens diferentes e redirects continuam bloqueados. A exceção não transforma a allowlist em wildcard.

## Readiness e discovery

Cadastre um servidor remoto no Orchestra com:

- `baseUrl=http://mcp-readonly-demo:8092`;
- `status=active`;
- `trustLevel=trusted`;
- `riskLevel=low`;
- `authType=none`;
- nenhum `secretRef`.

Na tela de detalhe MCP, use “Testar readiness seguro” e “Consultar catálogo read-only”. As rotas backend são:

```text
GET /api/v1/mcp/servers/:id/remote-readiness
GET /api/v1/mcp/servers/:id/remote-discovery
```

Flags desligadas, allowlist vazia e origem divergente bloqueiam antes do transporte. Indisponibilidade retorna erro sanitizado. O discovery expõe apenas status, versão de protocolo, nomes/descrições/schemas sanitizados, risco inferido, warnings seguros e metadata quantitativa.

## Tool call read-only

Para o gateway autorizar uma chamada, o catálogo governado deve conter a tool descoberta com:

- nome exatamente `catalog.search` ou `catalog.get_status`;
- `metadata.readOnly=true`;
- risco baixo e `requiresApproval=false`;
- policy `allowRuntimeExecution=true`, `sandboxOnly=false`, `blockedByDefault=false`, `requiresApproval=false`;
- binding ativo em `enabled_placeholder` sem override de approval;
- descriptor idêntico na spec do run publicado;
- assistant e runtime tool gateway explicitamente habilitados.

Runs sandbox continuam bloqueando MCP externo. Nenhuma configuração desta fase aumenta `maxToolCalls` ou cria autorização ampla.

## Critérios para externalMcpCalled=true

`externalMcpCalled=true` é emitido somente depois que:

1. gateway e policy aprovam a chamada;
2. egress aceita a origem;
3. o transporte realiza o HTTP local;
4. o demo retorna HTTP 2xx, JSON limitado e contrato válido;
5. a resposta informa `simulated=false` e passa pela validação de saída segura.

Timeout, erro de protocolo, resposta excessiva ou qualquer bloqueio anterior mantêm `externalMcpCalled=false`.

## Simulated true versus false

| Caminho | `externalMcpCalled` | `simulated` |
| --- | --- | --- |
| bloqueado antes do transporte | `false` | `true` |
| sandbox determinístico | `false` | `true` |
| fake injetado nos testes | `true` | `true` |
| HTTP real para o demo homologado | `true` | `false` |

`simulated=false` não significa conector corporativo ou produção; identifica somente a chamada HTTP real ao demo fictício.

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
- `status`, `toolCallsExecuted`, IDs técnicos e hashes governados

## Campos proibidos

- argumentos, input preview e body da requisição;
- conteúdo/output da tool em banco, audit ou eventos;
- headers, cookies, authorization ou redirect target;
- token, API key, password, secret real ou valor resolvido;
- `secretRef` em DTO público, analytics, audit ou eventos;
- stack trace, URL com credencial ou payload bruto do demo.

O conteúdo minimizado pode ser devolvido ao runtime solicitante, mas não é copiado para a persistência operacional.

## Validação manual

1. Execute os testes do demo e o smoke 16Q.
2. Suba somente o demo e valide `/health`, `/ready` e `/v1/catalog`.
3. Confirme que a ausência das flags bloqueia readiness e discovery.
4. Habilite somente as flags da tabela e a origem exata.
5. Valide readiness com `transportChecked=true`, `transportHealthy=true` e `simulated=false`.
6. Valide discovery contendo somente `catalog.search` e `catalog.get_status`.
7. Prepare tool/policy/binding pelo fluxo administrativo governado existente.
8. Execute um run publicado e confirme `externalMcpCalled=true`, `simulated=false`.
9. Repita em sandbox e confirme bloqueio antes do transporte.
10. Revise banco, eventos, audit e analytics sem copiar conteúdo bruto.

## Consultas SQL e auditoria

Consulte apenas campos técnicos e metadata sanitizada:

```sql
SELECT id, status, mode, input_hash, duration_ms, metadata, created_at
FROM mcp_tool_calls
WHERE mode = 'remote_controlled'
ORDER BY created_at DESC
LIMIT 20;
```

```sql
SELECT id, type, metadata, created_at
FROM mcp_tool_call_events
WHERE type IN ('precheck_passed', 'execution_started', 'execution_completed', 'blocked')
ORDER BY created_at DESC
LIMIT 50;
```

```sql
SELECT id, action, entity_id, metadata, created_at
FROM audit_logs
WHERE action IN (
  'mcp_remote_readonly_discovery_checked',
  'runtime_tool_gateway_mcp_remote_readonly_executed',
  'runtime_tool_gateway_blocked'
)
ORDER BY created_at DESC
LIMIT 50;
```

Não selecione nem exporte `input_preview`, `output_preview`, `secret_ref` ou payloads do Chat para evidência desta homologação.

## Rollback

1. Defina `MCP_REMOTE_EXECUTION_ENABLED=false`.
2. Defina `MCP_REMOTE_READONLY_ENABLED=false`.
3. Defina `MCP_REMOTE_DISCOVERY_ENABLED=false` e `MCP_REMOTE_ENABLED=false`.
4. Defina `MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO=false`.
5. Esvazie `MCP_REMOTE_EGRESS_ALLOWLIST` e `MCP_REMOTE_LOCAL_DEMO_ORIGIN`.
6. Remova o profile `mcp-demo` do comando Compose ou encerre somente esse serviço.
7. Desabilite binding/policy do catálogo sem apagar registros históricos.

O rollback não exige migration e preserva auditoria já produzida.

## Riscos remanescentes

- o contrato é MCP/HTTP controlado do Orchestra, não uma implementação universal do protocolo MCP;
- classificação read-only reduz risco, mas um servidor futuro ainda precisa de threat model próprio;
- o demo não resolve secret, não testa OAuth e não representa dados corporativos;
- o caminho real depende de configuração administrativa coerente de server/tool/policy/binding;
- retry, circuit breaker e rate limit por destino permanecem para evolução futura;
- apenas homologação isolada foi autorizada; produção segue proibida por default.

## Próximos passos para um conector real

Antes de integrar um fornecedor, exigir HTTPS com validação do endereço efetivamente conectado, contrato de protocolo versionado, secret manager, rotação, rate limit, circuit breaker, catálogo revisado, threat model, classificação de dados, plano de incidente, homologação isolada e aprovação operacional. Nenhum desses passos autoriza tools de escrita automaticamente.
