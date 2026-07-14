# Orchestra - Agno Bridge Docker Real 16H

## 1. Objetivo

A Fase 16H adiciona ao repositorio um servico Docker local `agno-bridge` capaz de executar o SDK Agno real por tras do contrato runtime V1 ja consumido pelo Orchestra:

```text
Browser -> Orchestra frontend -> Orchestra backend/control plane
                                -> AssistantRuntimeSpecV1
                                -> agno-bridge:8091
                                -> Agno SDK
                                -> provider LLM aprovado
                                -> RuntimeExecuteResponseV1
                                -> AgentRun + Chat persistidos
```

A decisao arquitetural e obrigatoria:

- `Orchestra = Control Plane`;
- `Agno = Runtime Executor`.

O bridge nao substitui RBAC, policy, retrieval, catalogo, precheck, limites, auditoria ou persistencia do Orchestra. Ele recebe um spec ja governado, executa somente esse spec e devolve uma resposta minimizada.

## 2. Entrega

A implementacao esta em `runtime/agno-bridge/` e inclui:

- servidor HTTP local com `GET /health`, `GET /capabilities` e `POST /execute`;
- validador strict do contrato Orchestra V1 sem dependencia do backend Node;
- integracao real com `agno==2.7.1` para OpenAI, Azure OpenAI e Anthropic;
- modo stub deterministico, exclusivamente offline, para testes e contrato;
- autenticacao bearer server-to-server nos tres endpoints;
- prompt efemero montado somente com input, instrucoes, conversa, RAG e descriptors recebidos;
- functions Agno dinamicas somente para descriptors governados e somente quando o gateway 16F esta deliberadamente ativo;
- callback opcional ao sandbox 16F, sem MCP externo;
- respostas, erros, usage e eventos limitados a campos allowlisted;
- Dockerfile sem root, healthcheck autenticado e override Compose seguro;
- testes Python standard-library e teste cruzado com os schemas Zod do backend;
- preflight 16H offline por default.

Nao houve alteracao do contrato do Chat, frontend, Prisma ou migrations.

## 3. Runtime minimo/fake versus bridge real

O comando existente:

```bash
npm --prefix backend run agno:runtime
```

continua iniciando o runtime HTTP minimo do backend. Ele e deterministico, anuncia `supportsExternalProviders=false`, executa zero tools e prova somente contrato/sandbox.

O novo `agno-bridge` usa o SDK Agno instalado dentro do container. Em `AGNO_BRIDGE_EXECUTION_MODE=real`, ele cria um `Agent` com o adapter do provider configurado, executa o modelo recebido no spec e anuncia provider externo apenas quando a configuracao obrigatoria esta presente. O modo `stub` do bridge existe para teste offline e nunca deve ser apresentado como provider real.

## 4. Defaults versionados e perfil real local

`backend/.env.example` permanece fail-closed:

```env
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=false
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
```

`runtime/agno-bridge/.env.example` tambem nao e um perfil real operacional. Ele usa stub, exige autenticacao com valor vazio, mantem RAG/tools/gateway desligados e deixa todas as provider keys vazias. Consequentemente, o container do override nao sobe ate existir uma configuracao local deliberada para a chave de transporte.

O perfil real completo deve existir somente em arquivos `.env` ignorados, Compose override local nao versionado, secret manager ou env do container. Nunca altere os exemplos versionados para facilitar uma demo.

## 5. Variaveis do backend Orchestra

Em `backend/.env` local ignorado, o perfil real basico e:

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_REQUIRE_PRECHECK=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false

AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://agno-bridge:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=30000
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=

AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false

AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
MCP_REMOTE_EXECUTION_ENABLED=false
```

Preencha a chave somente no arquivo ignorado ou por secret injection. O override Compose fixa a rota interna do backend em `http://agno-bridge:8091`, portanto um valor local divergente de base URL nao e necessario dentro do container.

O backend nao precisa de `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` para o caminho 16H. Essas variaveis nao existem no exemplo do backend.

## 6. Variaveis do bridge

Em `runtime/agno-bridge/.env` local ignorado:

```env
AGNO_BRIDGE_EXECUTION_MODE=real
AGNO_BRIDGE_PROVIDER=openai
AGNO_BRIDGE_ALLOWED_MODELS=

AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false

OPENAI_API_KEY=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-10-21
ANTHROPIC_API_KEY=

AGNO_TELEMETRY=false
```

Use exatamente um provider:

- `openai`: exige `OPENAI_API_KEY`;
- `azure_openai`: exige key e endpoint; se deployment for configurado, o model do spec precisa coincidir;
- `anthropic`: exige `ANTHROPIC_API_KEY`.

`AGNO_BRIDGE_ALLOWED_MODELS` e uma allowlist opcional separada por virgulas. Quando preenchida, o bridge rejeita model fora dela, mesmo que o Orchestra o tenha enviado. Sem allowlist adicional, o model governado do spec e usado.

Uma provider key ausente no modo real deixa `/health` como `misconfigured`, `supportsExternalProviders=false` e faz `/execute` falhar fechado. O valor nunca e devolvido ou registrado.

## 7. Chave de transporte

Backend e bridge devem receber a mesma `AGNO_RUNTIME_HTTP_SECURITY_KEY`. Ela autentica:

- backend -> bridge em health, capabilities e execute;
- bridge -> backend no callback opcional 16F.

No perfil real, mantenha `AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true` nos dois processos. Gere, armazene e rotacione a chave fora do Git. Ela e diferente da provider key e nunca entra no spec, output, evento, log ou frontend.

## 8. Contratos HTTP

### Health

`GET /health` retorna provider `agno`, protocolo `orchestra.runtime.assistant.v1`, timestamp e status:

- `healthy`: stub offline ou provider real configurado;
- `misconfigured`: modo real sem requisitos do provider.

Details contem somente modo, chamada externa agregada e uso de banco. Nao incluem package config, endpoint, key, header ou exception.

### Capabilities

`GET /capabilities` anuncia:

- `supportsStreaming=false`;
- `supportsExternalProviders=true` somente no modo real configurado;
- `supportsRagContext` coerente com o gate do bridge;
- `supportsTools` coerente com o gate do bridge;
- `supportsFileInputs=false`;
- `maxToolCalls` igual ao limite local do bridge.

### Execute

`POST /execute` valida o request V1 strict, correlaciona trace/run, aplica os gates locais e executa o provider. O bridge bloqueia:

- spec desconhecido, campos extras, payload sensivel ou incoerencia de contrato;
- attachments;
- RAG em modo gateway ou retrieval no runtime;
- RAG/descriptors enviados quando o gate correspondente esta falso;
- provider/model divergente da configuracao/allowlist;
- tool limit superior ao limite local;
- chamada de tool sem gateway;
- tool com approval ou risco diferente de low no perfil 16F;
- modo real sem provider key/requisitos.

Erros retornam somente codigo/mensagem governados, status, retryable e flags quantitativas. Exception interna, stack, config e payload original nao sao propagados.

## 9. Montagem de contexto e RAG

O prompt existe somente em memoria durante a chamada. Ele e montado com:

- instrucoes fixas de governanca;
- `instructions.system` e `instructions.developer` recebidas;
- mensagem atual;
- `conversationContext.messages` ja selecionadas pelo Orchestra;
- `rag.sources` ja resolvidas, limitadas e sanitizadas pelo Orchestra;
- descricao dos descriptors recebidos.

O bridge nao possui client de banco, vector store, storage, search ou knowledge base. Nao usa Agno Knowledge para retrieval nesta fase. Isso impede retrieval livre: se nao veio em `rag.sources`, nao pode ser buscado pelo bridge.

Output e eventos retornam apenas contagens RAG. Excerpts, IDs de fontes, chunks e prompt montado nao sao ecoados.

## 10. Descriptors e gateway sandbox 16F

Com tools habilitadas e `maxToolCalls=0`, descriptors sao recebidos e descritos ao executor, mas nenhuma Function executavel e registrada.

O callback 16F fica disponivel somente quando todos os itens sao verdadeiros:

```env
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=1
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=true
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
ORCHESTRA_TOOL_GATEWAY_URL=http://backend:3000/api/v1/runtime/agno/tool-calls
```

O override Compose fornece a URL privada; os gates permanecem no `.env` local. O bridge transforma somente descriptors low risk e sem approval em `agno.tools.Function`, preserva trace/run/assistant/tool/sequence e chama o endpoint 16F. A resposta aceita precisa declarar `externalMcpCalled=false` e resultado minimizado.

O bridge nunca cria MCPTools, nao faz discovery, nao recebe server URL/credential no spec e nao chama MCP externo. O gateway continua sendo a simulacao sandbox deterministica da 16F, com registry/idempotencia locais ao processo backend.

## 11. Como subir com Docker

1. Crie os dois arquivos ignorados locais.
2. Injete a mesma chave de transporte nos dois.
3. Coloque a provider key somente no bridge.
4. Mantenha RAG/tools/gateway falsos na primeira subida.
5. Execute:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.agno-bridge.yml up --build
```

O override:

- constroi `runtime/agno-bridge/Dockerfile`;
- publica `8091` para a homologacao local;
- faz o backend usar o hostname privado `agno-bridge`;
- aguarda o healthcheck autenticado do bridge;
- preserva `docker-compose.dev.yml` sem o servico quando o override nao e usado.

Como a autenticacao e obrigatoria e o placeholder e vazio, esquecer o `.env` local faz a subida falhar fechada em vez de abrir um runtime sem credencial.

## 12. Preflight, health e capabilities

Primeiro, sem rede:

```bash
scripts/smoke-agno-bridge-docker-16h.sh --dry-run
```

O modo offline valida arquivos, defaults backend, placeholders bridge, sintaxe Python e Compose combinado sem renderizar valores. Ele nao carrega `.env`.

Depois de exportar a configuracao de transporte na sessao autorizada:

```bash
scripts/smoke-agno-bridge-docker-16h.sh --check-runtime
```

Esse modo chama somente health e capabilities, exige provider externo real configurado e compara RAG/tools/maxToolCalls com o perfil exportado. Ele nao chama Chat, execute, provider ou gateway e nao mostra URL, chave, header ou body.

## 13. Como validar Chat real

1. Comece com RAG/tools/gateway falsos e limite zero.
2. Confirme preflight e capabilities com provider externo verdadeiro.
3. Use assistant publicado de teste com provider/model coerentes com o bridge.
4. Confirme policy explicitamente opt-in para o mesmo provider.
5. Abra conversa descartavel na UI e envie input sintetico nao sensivel.
6. Confirme `AgentRun` concluido via `agno_http`.
7. Confirme resposta persistida e vinculada ao run.
8. Confirme `externalProviderCalled=true`, provider/model logicos, usage e latencia.
9. Confirme ausencia de provider payload, prompt/contexto bruto, headers, keys e stack em UI/log/evidencia.

Os testes e smokes nunca fazem essa chamada; ela e manual e deliberada.

## 14. Como validar RAG/Knowledge real governado

1. Use knowledge base sintetica de teste, com readiness e binding autorizados.
2. Habilite `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true` no backend e no bridge.
3. Reinicie ambos e repita o preflight.
4. Pergunte pelo Chat algo coberto pelos dados de teste.
5. Confirme `ragMode=resolved_context`, fonte/caracteres dentro dos limites e resposta coerente.
6. Confirme que o bridge nao tem conexao ao banco/vector store/storage do Orchestra.
7. Nao capture excerpt, chunk, query, prompt ou body do execute.

Sem fonte, o spec deve usar `rag=none`. Um modo `gateway` de RAG e bloqueado pelo bridge.

## 15. Como validar descriptors/tools

No perfil descriptor-only:

1. prepare tool low risk, sem approval e binding sandbox de teste;
2. habilite descriptors nos dois lados;
3. mantenha gateway falso e limite zero;
4. confirme `supportsTools=true` e `maxToolCalls=0`;
5. envie Chat manual;
6. confirme `toolDescriptorCount>0`, `toolCallsExecuted=0` e `externalMcpCalled=false`;
7. confirme ausencia de schema, descriptor, args/output e configuracao MCP na resposta/evidencia.

## 16. Como validar o gateway sandbox

O bridge suporta o callback 16F. Para validacao deliberada:

1. confirme afinidade com a mesma instancia backend que iniciou o run;
2. habilite tools/gateway nos dois lados e limite exatamente um;
3. mantenha external tools e MCP remoto falsos;
4. reinicie processos e valide capabilities com `maxToolCalls=1`;
5. envie Chat que possa selecionar exatamente a tool low risk governada;
6. confirme `toolCallsExecuted=1`, `simulated=true` e `externalMcpCalled=false`;
7. confirme args/output/schema ausentes dos eventos e DTOs.

Esse teste comprova Agno -> callback 16F -> sandbox Orchestra. Nao comprova MCP/tool externa funcional.

## 17. Testes offline

Testes proprios do bridge:

```bash
python3 -m unittest discover -s runtime/agno-bridge/tests -v
npm --prefix backend run test -- --run runtime-agno-bridge-docker
```

Cobertura:

- health e capabilities;
- auth on/off nos tres endpoints;
- execute com stub injetado sem rede;
- trace V1;
- payload invalido/sensivel sem eco;
- RAG recebido do Orchestra e ausente da resposta;
- descriptors recebidos com zero execucao externa;
- provider real sem key em fail-closed;
- chave obrigatoria ausente rejeitada na inicializacao;
- payloads do Python aceitos pelos schemas Zod do backend;
- defaults backend fechados e provider keys somente no exemplo do bridge.

Nenhum teste importa o SDK Agno, chama internet, provider, Chat ou gateway.

## 18. Evidencias permitidas

Podem ser registradas:

- branch/commit e lista de arquivos;
- status generico de health/capabilities;
- runtime/provider/model logicos;
- status e IDs descartaveis de run;
- contadores de conversa/RAG/tools/usage;
- `externalProviderCalled`, `toolCallsExecuted`, `simulated` e `externalMcpCalled=false`;
- resultado de testes, typecheck, Compose quiet e greps;
- screenshot redigido sem dados privados.

## 19. Evidencias proibidas

Nunca registre ou anexe:

- `.env`, dump de env ou secret manager;
- transport key, provider key, header ou cookie;
- URL privada sensivel ou connection string;
- request/response body completo;
- raw prompt, instrucoes ocultas ou contexto conversacional;
- excerpt/chunk/documento RAG;
- provider payload/raw output;
- descriptor/schema/args/output de tool;
- stack trace ou exception com config.

## 20. Limitacoes e fora do escopo

- MCP externo real e tool externa real;
- approval humano produtivo;
- vault/secret manager produtivo;
- egress policy de infraestrutura;
- deploy cloud, TLS/ingress produtivo e escala horizontal;
- frontend, migration ou contrato novo;
- streaming e file inputs;
- retry/circuit breaker/queue;
- retrieval Agno/Knowledge livre;
- idempotencia distribuida do gateway;
- testes automatizados com provider real;
- prova de qualidade factual do modelo.

## 21. Rollback

No backend local:

```env
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=false
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
```

Depois:

1. pare a stack que usa o override ou suba somente `docker-compose.dev.yml`;
2. reinicie o backend;
3. confirme provider local healthy;
4. descarte/rotacione a chave de transporte;
5. remova provider keys do processo/secret local se a janela terminou;
6. nao remova volumes nem resete o banco;
7. confirme worktree sem `.env` ou segredo.

Nao ha migration ou dado que exija rollback destrutivo.

## 22. Riscos remanescentes

- API e comportamento do SDK/provider podem mudar; a versao Agno esta fixada e upgrades exigem nova homologacao;
- custo, cota, latencia e disponibilidade pertencem ao provider;
- input/output funcional do Chat ainda pode conter dado de negocio e segue o acesso da conversa;
- o prompt efemero contem contexto autorizado e depende do isolamento do container/processo;
- proxy/APM/Docker podem capturar env, headers ou bodies se redaction estiver mal configurada;
- o gateway 16F depende da mesma instancia backend e perde registry em reinicio;
- timeout pode ocorrer depois do provider iniciar consumo;
- allowlist de model vazia confia na selecao governada do Orchestra;
- o servidor HTTP e destinado a demo/homologacao local, nao a exposicao publica;
- o bridge nao implementa egress enforcement de infraestrutura.

Esses riscos mantem o uso em ambiente local/controlado, com secrets fora do Git, logs minimizados e rollback disponivel.
