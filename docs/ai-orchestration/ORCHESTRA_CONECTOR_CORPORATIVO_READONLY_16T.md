# Orchestra — Conector corporativo read-only 16T

## Objetivo

A Fase 16T prepara o primeiro boundary corporativo real do Orchestra com postura extremamente conservadora: uma única tool de status, somente leitura, risco baixo, resposta não sensível e execução pelo mesmo gateway MCP governado das fases 16P–16S.

Esta branch não configura nem chama endpoint corporativo real. O adapter está implementado, mas permanece desabilitado e sem origem. A ativação depende de um endpoint de homologação aprovado, origem HTTPS exata, resolução server-side de `secretRef`, flags explícitas, readiness verde e objetos de policy/binding revisados.

## Escopo

- adapter `corporate-readonly` dentro de `backend/src/modules/mcp/remote`;
- roteamento governado entre demo local, adapter corporativo e transporte fail-closed;
- tool fixa `corporate.status.read`, read-only e low risk;
- apenas `GET /health`, `GET /v1/status` e `GET /v1/status/availability`;
- input restrito ao enum `scope=summary|availability`;
- timeout de 3 segundos e resposta máxima de 16 KiB por default;
- allowlist MCP global mais origem corporativa exata;
- `secretRef` lógico com resolução exclusivamente no backend;
- resumo de saída limitado a `status`, `summary` e `updatedAt`;
- testes unitários, evals offline 16S, UI informativa e smoke estático 16T.

## Fora de escopo

- Gmail, Drive, Slack, e-mail, mensageria, ERP ou banco transacional;
- produção, deploy, migration, mudança de Prisma schema ou seed;
- dados pessoais, financeiros, comerciais restritos ou qualquer conteúdo sensível;
- POST, PUT, PATCH, DELETE, mutation, aprovação, envio ou side effect externo;
- URL, path, query, fragment ou headers informados pela tool;
- API key, token ou senha no frontend, banco, audit, Analytics ou repositório;
- discovery amplo, catálogo remoto arbitrário ou mais de uma tool corporativa;
- bypass do gateway, execução em sandbox ou habilitação MCP por default;
- prompt, contexto, args, output ou body bruto em logs e metadata.

## Escolha segura do primeiro conector

O alvo escolhido é `corporate.status.read`. Ele deve consultar somente um serviço de homologação dedicado a status operacional não sensível. O serviço não pode compartilhar endpoint, identidade ou base de dados com Gmail, Drive, Slack, ERP, sistemas transacionais ou produção.

O contrato remoto é deliberadamente pequeno:

| Método/path | Finalidade | Resposta mínima |
|---|---|---|
| `GET /health` | readiness técnica | serviço identificado, `readOnly=true`, classificação `non_sensitive` |
| `GET /v1/status` | resumo geral | `status`, `summary`, classificação e marcador read-only |
| `GET /v1/status/availability` | resumo de disponibilidade | o mesmo schema sanitizável |

Não há URL arbitrária, header arbitrário nem payload de request. O parâmetro `scope` apenas escolhe um dos dois paths compilados no adapter.

## Requisitos de aprovação

Antes de qualquer homologação real, um responsável deve registrar fora do Git:

1. owner técnico e owner de dados;
2. confirmação de que o ambiente é de homologação e não usa dados sensíveis;
3. origem HTTPS única, sem path, query, fragment, usuário ou senha;
4. DNS e todos os IPs resolvidos revisados como públicos e não metadata/private;
5. certificado TLS e política de rotação aprovados;
6. referência lógica de secret e mecanismo server-side de resolução aprovados;
7. identidade com permissão exclusiva de leitura do status;
8. resposta máxima, timeout, rate limit e janela de homologação;
9. server, tool, policy e binding exatos, todos low risk/read-only;
10. plano de revogação do secret, remoção de allowlist e desligamento das flags.

A existência deste código não constitui aprovação. Sem todos os itens, o estado esperado é bloqueado.

## Flags e envs

Defaults versionados:

```text
MCP_REMOTE_ENABLED=false
MCP_REMOTE_DISCOVERY_ENABLED=false
MCP_REMOTE_EXECUTION_ENABLED=false
MCP_REMOTE_READONLY_ENABLED=false
MCP_REMOTE_EGRESS_ALLOWLIST=
MCP_REMOTE_REQUIRE_SECRET_REF=true
MCP_REMOTE_ALLOW_WRITE_TOOLS=false
MCP_CORPORATE_READONLY_ENABLED=false
MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=
MCP_CORPORATE_READONLY_TIMEOUT_MS=3000
MCP_CORPORATE_READONLY_MAX_RESPONSE_BYTES=16384
```

O compose de produção mantém todos esses gates fechados. Para homologação isolada, a origem aprovada deve aparecer simultaneamente em `MCP_REMOTE_EGRESS_ALLOWLIST` e `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN`. A segunda variável aceita exatamente uma origem HTTPS; path, query, fragment e credenciais embutidas invalidam a configuração.

`MCP_REMOTE_EXECUTION_ENABLED=true` e `MCP_REMOTE_READONLY_ENABLED=true` são requisitos cumulativos, não substitutos. `MCP_REMOTE_ALLOW_WRITE_TOOLS` deve permanecer `false`.

## SecretRef

O registro do server guarda somente uma referência lógica. O resolver default do adapter aceita referências com o formato:

```text
env://ORCHESTRA_CORPORATE_READONLY_STATUS
```

O valor correspondente deve ser injetado no processo backend pelo secret manager aprovado. Ele não deve ser digitado na UI, gravado em `.env.example`, incluído em Compose, exibido por comandos de diagnóstico ou anexado como evidência.

O adapter aceita apenas autenticação `bearer`, resolve o valor no instante da chamada e monta internamente o único header necessário. Ausência da referência, referência fora do namespace permitido, valor ausente ou formato inseguro falha antes do transporte. Para cofre não baseado em env, implemente um `CorporateReadonlyCredentialResolver` server-side revisado; não altere o DTO para receber valor bruto.

## Allowlist e egress

A chamada passa primeiro por `validateMcpRemoteEgress`, que exige HTTPS, origem presente na allowlist global, DNS resolvido e ausência de IP privado, loopback, link-local, faixa reservada ou host de metadata. Depois, o roteador exige igualdade com a origem corporativa dedicada.

O adapter repete a validação estrutural e só aceita base URL igual à raiz da origem. São bloqueados:

- HTTP fora do demo local controlado;
- origem não allowlistada;
- path configurável, query string ou fragment;
- usuário ou senha embutidos;
- localhost, `.local`, metadata e IPs privados/reservados;
- redirect HTTP;
- DNS sem resolução pública ou com qualquer resposta privada.

Esse encadeamento evita que a seleção do adapter substitua o egress guard global.

## Readiness

Readiness é condição necessária, nunca autorização suficiente. A sequência esperada é:

1. feature MCP remota habilitada explicitamente;
2. server ativo, trusted e low risk;
3. auth bearer com `secretRef` configurado;
4. policy de discovery revisada;
5. allowlists global e corporativa exatas;
6. egress/DNS aprovados;
7. adapter corporativo habilitado;
8. `GET /health` retorna contrato read-only/non-sensitive válido.

Qualquer falha retorna readiness bloqueada/misconfigured ou erro sanitizado. A UI mostra somente status, `failClosed`, `simulated` e host sanitizado. Ela não recebe o `secretRef` nem o valor resolvido.

## Execução read-only

A execução é permitida somente para run publicado e atravessa:

```text
AgentRun publicado
  -> descriptor da tool no spec assinado
  -> binding assistant/server/tool habilitado
  -> policy atual allowRuntimeExecution=true
  -> blockedByDefault=false e sandboxOnly=false
  -> classifier read-only + dangerous-operation check
  -> risco low e approval satisfeito
  -> flags MCP + flag corporativa
  -> allowlist + egress SSRF/DNS
  -> secretRef lógico
  -> McpRemoteClient
  -> CorporateReadonlyHttpTransport
  -> GET fixo
```

Não existe controller ou client paralelo. O gateway calcula hash dos argumentos, limita payload e chamadas, revalida estado corrente e só então cria o client. A resposta remota é lida de forma limitada, rejeita chaves/valores sensíveis e é reduzida antes de retornar ao client.

## Matriz permitido e bloqueado

| Cenário | Resultado |
|---|---|
| todas as flags, origem, DNS, secretRef, policy, binding e readiness aprovados; tool exata | permitido em run publicado |
| `MCP_CORPORATE_READONLY_ENABLED=false` | transporte fail-closed |
| execução MCP ou read-only desabilitados | bloqueado antes do adapter |
| origem corporativa vazia ou diferente | transporte fail-closed |
| HTTP, query, fragment ou credenciais na URL | egress bloqueado |
| host privado, loopback, metadata ou DNS misto | egress bloqueado |
| secretRef ausente ou auth diferente de bearer | bloqueado antes do request |
| tool diferente de `corporate.status.read` | tool bloqueada |
| nome/operação write-like ou `readOnly=false` | bloqueado pelo classifier |
| risco diferente de low ou approval pendente | bloqueado pela policy |
| run sandbox, sem publicação ou sem binding | bloqueado pelo gateway |
| redirect, timeout, resposta grande ou schema inesperado | falha sanitizada |
| resposta com campo/valor sensível | falha sanitizada sem eco |

## Como homologar sem dados sensíveis

1. Execute primeiro toda a suíte offline e o smoke 16T.
2. Obtenha aprovação formal do serviço de homologação e confirme o schema de três campos.
3. Configure a mesma origem HTTPS exata nas duas allowlists, fora do Git.
4. Injete a credencial read-only pelo secret manager e registre apenas o `secretRef` lógico no server.
5. Crie o server como remote, disabled, trusted, low risk e auth bearer.
6. Ative apenas as flags de readiness/discovery e valide o bloqueio esperado antes da abertura.
7. Ative a flag corporativa e rode readiness; interrompa se host, classificação ou serviço divergirem.
8. Faça discovery: deve retornar somente `corporate.status.read`, low risk, policy default bloqueada e sandbox-only.
9. Revise e aplique o catálogo pelo fluxo de aprovação existente; crie binding para um assistant de homologação.
10. Abra policy somente para run publicado e uma chamada; mantenha write tools desabilitadas.
11. Execute primeiro `scope=summary` e depois, se aprovado, `scope=availability`.
12. Revise somente evidências allowlistadas e aplique rollback imediatamente após a janela.

Não use `curl -v`, dump de environment, tracing de headers, proxy com body logging ou screenshot de resposta. A homologação deve registrar hashes, IDs, booleans, status, latência e bytes — nunca conteúdo bruto.

## Evidências esperadas

Campos permitidos em audit/observability/Analytics:

- IDs técnicos de run, server e tool;
- status e timestamps;
- host sanitizado;
- `mcpRemoteToolId` e `mcpRemoteRiskLevel`;
- `externalMcpCalled` e `simulated`;
- `mcpRemoteAllowed`, `mcpRemoteBlocked` e reason sanitizado;
- `latencyMs` e `responseBytes`;
- `rawContentLogged=false`.

Campos proibidos:

- prompt e contexto brutos;
- args, output, response ou body brutos;
- headers, cookies e `Authorization`;
- `secretRef` e valor de credencial;
- API key, password, connection string ou URL interna completa;
- stack, request/response dump e payload do provider.

O conteúdo sanitizado da tool pode alimentar a resposta do run, mas não deve ser copiado para audit, eventos ou Analytics. Nessas superfícies ficam apenas sinais técnicos allowlistados.

## Consultas SQL seguras

Execute somente em homologação e projete campos técnicos. Não selecione metadata completa, `input_summary`, `base_url`, `secret_ref`, payload ou snapshots.

```sql
SELECT
  id,
  agent_run_id,
  mcp_server_id,
  mcp_tool_id,
  status,
  risk_level_snapshot,
  duration_ms,
  created_at
FROM mcp_tool_calls
WHERE mcp_tool_id = '<tool-id-aprovado>'
ORDER BY created_at DESC
LIMIT 20;
```

```sql
SELECT
  entity_id,
  action,
  request_id,
  created_at
FROM audit_logs
WHERE entity = 'agent_run'
  AND action IN ('runtime_tool_gateway_completed', 'runtime_tool_gateway_blocked')
ORDER BY created_at DESC
LIMIT 20;
```

Use a API de observabilidade para conferir `externalMcpCalled`, `mcpRemoteAllowed`, `mcpRemoteBlocked`, `mcpRemoteBlockedReason`, `latencyMs`, `responseBytes` e `rawContentLogged`. Não faça consultas exploratórias em colunas JSON.

## Rollback

Ordem de contenção:

1. defina `MCP_CORPORATE_READONLY_ENABLED=false`;
2. defina `MCP_REMOTE_EXECUTION_ENABLED=false`;
3. remova a origem das allowlists corporativa e global;
4. desabilite binding, tool e server;
5. revogue a identidade no secret manager;
6. mantenha runs, eventos e audit técnicos para investigação;
7. rode novamente evals 16S e smoke 16T.

O rollback não exige migration ou remoção de dados. Não apague histórico para ocultar uma tentativa bloqueada.

## Critérios para avançar para um conector real sensível

Um conector sensível só pode ser considerado em fase posterior quando:

- a 16T permanecer estável em múltiplas janelas de homologação;
- nenhuma resposta, log, evento ou tela expuser dado bruto;
- rotação/revogação e incident response forem exercitados;
- limites, rate limiting, disponibilidade e falhas forem medidos;
- owners de segurança, privacidade e dados aprovarem escopo mínimo;
- houver threat model específico para identidade, dados e side effects;
- evals cobrirem abuso próprio do conector e isolamento entre tenants;
- escrita continuar fora de escopo ou possuir arquitetura/approval independente.

Gmail, Drive, Slack, ERP e banco transacional não são uma extensão automática deste adapter.

## Riscos remanescentes

- o serviço corporativo ainda pode mudar schema ou classificação sem aviso;
- uma credencial read-only comprometida ainda permite leitura dentro do escopo concedido;
- DNS e certificados podem mudar entre aprovação e execução;
- o resumo remoto pode conter dado indevido apesar do contrato, causando bloqueio e incidente;
- allowlists e policy podem sofrer erro operacional fora do código;
- o resolver `env://` depende da higiene do ambiente e do secret manager;
- não houve chamada real nesta fase, portanto disponibilidade e compatibilidade do endpoint continuam não comprovadas.

Esses riscos justificam manter o adapter desabilitado até existir endpoint de homologação não sensível e aprovação explícita.
