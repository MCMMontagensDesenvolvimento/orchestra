# Orchestra - Demo Local Ponta a Ponta com Agno Real 16G

## 1. Objetivo

A Fase 16G empacota a homologacao e a demonstracao interna local do caminho:

```text
Orchestra frontend local
  -> Orchestra backend local
  -> AgentRun governado
  -> agno_http autenticado
  -> Agno runtime real/local
  -> provider LLM real no Agno
  -> RAG/knowledge resolvido pelo Orchestra
  -> descriptors MCP/tools governados
  -> tool gateway sandbox deterministico 16F
  -> resposta persistida no Chat
```

A decisao arquitetural permanece obrigatoria:

- `Orchestra = Control Plane`;
- `Agno = Runtime Executor`.

Esta fase entrega runbook, checklist e preflight. Ela nao altera frontend, contrato do Chat, schemas, migrations ou defaults produtivos. Nao automatiza Chat, provider, tool ou MCP. MCP externo real, shell e comando arbitrario continuam proibidos.

## 2. Arquitetura e responsabilidades

O Orchestra autentica o usuario, aplica tenant/workspace scope, seleciona assistant/publication, resolve policy, contexto conversacional, RAG e descriptors, fixa limites, cria o `AgentRun`, autentica o canal com o Agno, governa o callback da tool sandbox e persiste a resposta do Chat.

O Agno recebe o `AssistantRuntimeSpecV1` minimizado, usa o provider/model autorizados, considera somente o contexto e os descriptors entregues e devolve o contrato V1. Quando a demonstracao de tool esta habilitada, o Agno solicita o callback interno ao Orchestra; ele nunca executa MCP diretamente nem decide risco, approval, binding ou limite.

```text
Browser -- { input } --> Orchestra -- spec V1 --> Agno -- request LLM --> provider
                           |                 |
                           |<-- callback ----|  somente gateway 16F
                           |   autenticado
                           v
                    sandbox deterministico
                           |
                           v
                  AgentRun + Chat persistidos
```

As duas credenciais possuem dominios diferentes:

- a chave de transporte autentica o canal privado Orchestra <-> Agno;
- a key do provider autentica somente o Agno perante o provider LLM.

Uma nunca substitui a outra.

## 3. Estado real do runtime incluído no repositorio

O comando `npm --prefix backend run agno:runtime` inicia o runtime HTTP minimo Agno-compatible do repositorio. Ele serve para contrato, fake/sandbox e regressao. Seu `/capabilities` declara `supportsExternalProviders=false` e `maxToolCalls=0`.

Esse runtime minimo:

- valida os contratos V1;
- suporta health, capabilities, RAG resolvido e descriptors;
- produz resposta deterministica;
- nao chama provider LLM real;
- nao implementa callback de rede para o gateway 16F;
- nao executa MCP externo.

Portanto, a demo completa 16G exige um runtime Agno externo/local compativel com os contratos V1, com provider real e, para o ultimo cenario, callback 16F. O runtime minimo nao pode ser apresentado como Agno real nem como prova ponta a ponta do gateway.

Se o Agno disponivel nao implementar callback, mantenha gateway desligado e limite zero. Demonstre o restante do fluxo e apresente a 16F somente pelas suites backend, deixando a limitacao explicita.

## 4. Componentes e pre-requisitos

Componentes necessarios:

- Node.js 20 LTS e npm 10+;
- PostgreSQL local compativel com o projeto;
- backend Orchestra;
- frontend Orchestra em modo real, sem mocks;
- runtime Agno local/externo compativel com V1;
- conta e cota de um provider LLM aprovadas;
- usuario de teste autorizado;
- assistant publicado de teste com policy `published` autorizada;
- knowledge base de teste com conteudo sintetico e nao sensivel;
- server/tool/binding de teste low risk, sem approval e `sandbox_only`;
- `curl`, Python 3 e OpenSSL para os preflights e a chave descartavel.

Antes da janela:

1. confirme branch e worktree;
2. revise o diff e os greps de seguranca;
3. confirme que logs/APM nao capturam request/response body, headers ou cookies;
4. confirme que o runtime Agno aplica o contrato V1 strict;
5. confirme provider/model e limite financeiro;
6. confirme que MCP externo e qualquer executor arbitrario estao desligados;
7. defina responsavel por demo, observabilidade e rollback;
8. use somente dados e identidades descartaveis de teste.

## 5. Portas e topologia local

| Componente | Porta padrao | Observacao |
| --- | ---: | --- |
| Frontend Orchestra | 5173 | UI local, `VITE_USE_MOCKS=false` |
| Backend Orchestra | 3000 | API e callback governado 16F |
| PostgreSQL | 5432 | banco local de desenvolvimento |
| Agno runtime | 8091 | health, capabilities e execucao contratual V1 |

A topologia recomendada para a primeira demo e executar backend, frontend e Agno diretamente no mesmo host, deixando somente o banco em container. Assim `http://127.0.0.1:8091` e loopback real para o backend.

Se o backend estiver em Docker, `127.0.0.1:8091` aponta para o proprio container, nao para o host. Nesse caso use um hostname de host resolvivel pelo container ou coloque Orchestra e Agno na mesma rede privada. Valide a rota sem expor a URL em evidencias. O `docker-compose.dev.yml` atual nao inclui um servico Agno nem configura automaticamente essa resolucao.

## 6. Chave local descartavel

Gere a chave fora do Git, em um terminal privado e com historico/projecao de tela controlados:

```bash
openssl rand -hex 32
```

Opcionalmente, redirecione a saida para um secret store ou arquivo temporario fora do workspace com permissoes restritas. Nao use arquivo dentro do repositorio.

No Orchestra:

```env
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

No Agno:

```env
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=<mesma-secret-local-descartavel>
```

Regras obrigatorias:

- use exatamente o mesmo valor nos processos Orchestra e Agno;
- nao envie o valor no Chat, mensagem, ticket ou documento;
- nao cole o valor em evidencias ou comandos compartilhados;
- nao grave o valor em `.env` dentro do repositorio;
- nao faça commit;
- nao reutilize a chave em producao ou outro ambiente;
- nao use uma key de provider como chave de transporte;
- descarte/rotacione a chave imediatamente depois da apresentacao.

O mesmo canal autenticado protege Orchestra -> Agno e o callback Agno -> Orchestra da 16F. O browser nunca recebe essa chave.

## 7. Checklist de variaveis do Orchestra

Injete as variaveis no processo local por mecanismo fora do Git. O bloco e uma referencia com valor sensivel vazio:

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_REQUIRE_PRECHECK=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false

AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=30000
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=

AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true
AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES=5
AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS=1200
AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS=6000

AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true
AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS=8
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=1
AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS=6000
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=true
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES=32768

AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
MCP_REMOTE_EXECUTION_ENABLED=false
```

Existem dois perfis validos:

1. baseline 16E segura: `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0` e `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false`;
2. demo 16G deliberada: `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=1` e `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=true`, somente com callback suportado e sandbox deterministico 16F.

O `.env.example` permanece com `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0` e gateway desligado. Nao altere o default para acomodar a demo.

## 8. Checklist de variaveis do Agno

A configuracao exata de provider depende do runtime Agno adotado. O baseline conceitual e:

```env
AGNO_RUNTIME_HTTP_HOST=127.0.0.1
AGNO_RUNTIME_HTTP_PORT=8091
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=<mesma-secret-local-descartavel>

# Provider real fica somente no Agno:
OPENAI_API_KEY=
# ou AZURE_OPENAI_API_KEY=
# ou ANTHROPIC_API_KEY=
```

Configure tambem, no mecanismo proprio do Agno, o provider, modelo/deployment, timeout, cota e allowlist aprovados. Nao configure a key do provider no Orchestra para esta trilha. Nao coloque provider key no spec, frontend, Chat, log ou evidencia.

Para RAG, o Agno deve consumir exclusivamente `rag.sources` resolvidas pelo Orchestra. Para tools, deve consumir somente os descriptors do spec. Para a 16F, configure privadamente no Agno o callback local `POST /api/v1/runtime/agno/tool-calls` e a autenticacao do mesmo canal; URL e chave nao entram no spec nem no DTO publico.

Capabilities minimas para a demo completa:

- protocolo `orchestra.runtime.assistant.v1`;
- provider logico `agno`;
- `supportsExternalProviders=true`;
- `supportsRagContext=true` quando RAG estiver habilitado;
- `supportsTools=true` quando descriptors/gateway estiverem habilitados;
- `maxToolCalls` coerente com o perfil ativo.

## 9. Subida dos servicos

Nao coloque `.env` real no workspace. Use uma sessao local ou secret launcher aprovado. Uma sequencia segura, com terminais separados, e:

1. iniciar o PostgreSQL local, por exemplo somente o servico de banco do compose;
2. apontar o `DATABASE_URL` do backend nativo para o host local, sem publicar seu valor;
3. aplicar somente as migrations ja versionadas e gerar o Prisma Client;
4. iniciar o runtime Agno real com a chave de transporte e a provider key injetadas;
5. iniciar o backend Orchestra com o perfil da etapa atual;
6. iniciar o frontend com `VITE_USE_MOCKS=false`;
7. validar os healthchecks antes de abrir a UI.

Comandos nao sensiveis usuais:

```bash
docker compose -f docker-compose.dev.yml up -d db
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate:deploy
npm --prefix backend run dev
npm --prefix frontend run dev
```

O comando do Agno real depende do runtime externo. Nao use `npm --prefix backend run agno:runtime` como substituto da demo real; ele serve apenas para contrato/fake.

Se optar por todo o Orchestra via Compose, valide a conectividade privada container -> Agno antes da janela e nunca exponha a chave por `docker compose config`, logs ou captura de terminal.

## 10. Preflight offline

O preflight 16G nao carrega arquivo de ambiente. Exporte as variaveis no processo e execute:

```bash
scripts/smoke-agno-demo-local-16g.sh --dry-run
scripts/smoke-agno-demo-local-16g.sh --check-orchestra-config
scripts/smoke-agno-demo-local-16g.sh --print-checklist
```

O default sem argumento tambem e `--dry-run`.

O script valida:

- `RUNTIME_PROVIDER=agno_http`, adapter e precheck ativos;
- fallback e external tools desligados;
- runtime HTTP e autenticacao obrigatoria ativos;
- presenca e formato da chave sem exibir o valor;
- URL segura e timeout limitado sem exibir a URL;
- limites de RAG, descriptors, schema e payload;
- RAG e descriptors como flags opcionais da demo;
- gateway falso com limite zero, ou gateway verdadeiro com limite exatamente um;
- gates de tool externa e MCP remoto falsos.

Ele nao acessa rede, Chat, endpoint de execucao, callback, provider ou MCP no modo default.

### Ordem com os preflights anteriores

O smoke 16E exige gateway falso e limite zero. Nao o rode depois de ativar o perfil 16G. Use esta ordem:

1. configure o baseline 16E (`gateway=false`, `maxToolCalls=0`);
2. rode `scripts/smoke-agno-runtime-security-16d.sh --dry-run`;
3. rode `scripts/smoke-agno-real-16e.sh --dry-run`;
4. opcionalmente valide health/capabilities do baseline 16E;
5. altere deliberadamente para o perfil 16G (`gateway=true`, `maxToolCalls=1`);
6. reinicie Orchestra e Agno;
7. rode o preflight 16G offline e online.

Assim, uma falha esperada do 16E nao e confundida com regressao.

## 11. Health e capabilities autenticados

Depois do preflight offline:

```bash
scripts/smoke-agno-demo-local-16g.sh --check-runtime
```

Esse modo chama somente `/health` e `/capabilities`. A chave e enviada por canal interno ao cliente HTTP, e respostas sao mantidas em arquivos temporarios com `umask 077`, validadas e removidas. O script nao mostra URL, header, chave, body ou provider key.

O check exige health `healthy` ou `degraded` e valida contrato/protocolo. Em capabilities, exige suporte a provider externo e, conforme o perfil, RAG/tools. Tambem exige `maxToolCalls` exatamente coerente com o valor governado local. Uma divergencia falha fechada.

`degraded` somente pode prosseguir quando a causa estiver identificada, aprovada e sem impacto em autenticacao, contrato, provider, governanca ou redaction.

O runtime minimo do repo falha corretamente neste preflight 16G porque nao suporta provider externo e anuncia limite zero. Para validar apenas esse fake, use os smokes contratuais anteriores e nao registre evidencia como demo real.

## 12. Chat simples com LLM real

Esta etapa e manual. O script nunca cria conversa nem chama Chat.

1. Confirme frontend, backend e Agno saudaveis.
2. Confirme que a provider key existe somente no processo Agno.
3. Entre na UI local com usuario de teste.
4. Escolha um assistant publicado de teste, com policy de `published`, provider e modelo aprovados.
5. Abra uma conversa descartavel.
6. Envie um prompt curto, sintetico e nao sensivel.
7. No DevTools, confira apenas que o request do frontend possui a unica chave publica `input`; nao copie nem salve o body.
8. Confirme `AgentRun` concluido, modo `published` e runtime `agno_http`.
9. Confirme `externalProviderCalled=true` e provider/model coerentes, sem provider payload bruto.
10. Confirme resposta do assistant persistida e vinculada ao mesmo `AgentRun`.
11. Confirme ausencia de chave, header, cookie, prompt bruto, contexto bruto e stack trace em UI, eventos e logs autorizados.

Se o provider estiver indisponivel e fallback estiver falso, a falha governada e o resultado correto. Nao ative fallback para salvar a apresentacao.

## 13. Chat com RAG/knowledge

1. Crie ou reutilize uma knowledge base exclusivamente de teste.
2. Indexe conteudo sintetico, nao sensivel e facil de verificar.
3. Vincule a knowledge base ao assistant publicado de teste.
4. Confirme readiness e chunks indexados por contadores, sem capturar chunks.
5. Habilite `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true` no Orchestra.
6. Reinicie o backend e rode novamente o preflight 16G.
7. Envie pela UI uma pergunta coberta pelo conteudo de teste.
8. Confirme na observabilidade allowlisted:
   - `ragMode=resolved_context`;
   - `ragSourceCount > 0`;
   - `ragContextChars > 0`;
   - `maxRagResults` coerente;
   - resposta funcional coerente com o conteudo.
9. Confirme que o Agno nao realizou retrieval livre e nao acessou banco/vector store do Orchestra.
10. Nao capture excerpt, chunk, raw context, query interna ou payload do spec como evidencia.

RAG sem fontes deve produzir contadores zero/none coerentes. Nao invente fonte nem habilite retrieval direto no Agno.

## 14. Chat com descriptors MCP/tools

Prepare uma tool de demonstracao sem credencial e sem efeito externo:

- server ativo, nao arquivado e `trusted`;
- tool ativa, `riskLevel=low` e schema pequeno;
- binding ativo, especifico para a tool e `sandbox_only`;
- `approvalRequired=false` em tool, binding e policy;
- sem endpoint/credential de MCP remoto;
- sem argumento que represente header, URL, chave, token ou comando.

Depois:

1. habilite `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true`;
2. no perfil descriptor-only, mantenha gateway falso e limite zero;
3. reinicie o backend e rode o preflight adequado;
4. envie uma conversa manual que permita ao runtime considerar a capacidade;
5. confirme:
   - `toolDescriptorCount > 0`;
   - `approvalRequiredCount=0`;
   - `blockedRiskCount=0`, caso o runtime exponha esse contador allowlisted;
   - `maxToolCalls=0` no perfil descriptor-only;
   - `toolCallsExecuted=0` e `externalMcpCalled=false`;
   - schema/descriptor raw ausentes do DTO publico, evento, Chat e evidencia.

Descriptor nao e permissao de execucao. O Agno nao pode fazer discovery livre ou chamar MCP diretamente.

## 15. Chat com tool gateway sandbox 16F

So execute esta etapa se o Agno real implementar o callback 16F e puder ser configurado sem expor URL ou chave.

1. Confirme que backend e Agno usam a mesma chave descartavel.
2. Confirme que o callback alcanca a mesma instancia do backend que iniciou o `AgentRun`; o registry 16F e local ao processo.
3. Configure privadamente no Agno `POST /api/v1/runtime/agno/tool-calls` com autenticacao server-to-server.
4. Confirme tool low risk, sem approval, server trusted e binding `sandbox_only`.
5. Defina somente localmente:

   ```env
   AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=true
   AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=1
   ```

6. Mantenha `RUNTIME_ALLOW_EXTERNAL_TOOLS=false`, `AGNO_ALLOW_EXTERNAL_TOOLS=false`, `AGNO_ALLOW_REMOTE_MCP=false` e `MCP_REMOTE_EXECUTION_ENABLED=false`.
7. Reinicie Orchestra e Agno e rode o preflight 16G offline/online.
8. Pela UI, envie uma conversa sintetica que solicite exatamente a tool sandbox autorizada.
9. Confirme:
   - `toolCallsExecuted=1`;
   - `externalMcpCalled=false`;
   - `simulated=true` nos eventos allowlisted do gateway;
   - resposta final persistida no Chat;
   - eventos sem args, output, schema, header ou secret;
   - `McpToolCall.inputHash` presente;
   - `inputPreview` e `outputPreview` ausentes.
10. Em uma conversa separada e controlada, configure o Agno de teste para solicitar uma segunda chamada ou uma tool nao anexada ao spec. Confirme bloqueio fail-closed, zero execucao adicional e ausencia de MCP externo. Nao invoque o callback manualmente com payload ad hoc durante a apresentacao.

Se o Agno nao tiver callback:

- restaure gateway falso e limite zero;
- nao simule uma chamada falsa no runbook;
- valide a fronteira somente com `backend/tests/runtime/runtime-tool-gateway.test.ts` e `backend/tests/api/agent-runs.test.ts`;
- declare na apresentacao que a integracao de rede Agno -> Orchestra nao foi demonstrada.

## 16. Evidencias permitidas

Pode registrar, sempre com dados de teste e redaction:

- branch e commit base;
- status generico de health/capabilities;
- runtime `agno_http`;
- ID tecnico descartavel, status e timestamps do `AgentRun`;
- provider/model logicos e `externalProviderCalled`;
- contadores RAG;
- contadores de descriptors/tools;
- `externalMcpCalled=false`;
- `simulated=true`;
- `toolCallsExecuted`;
- `inputHash` presente, sem seu input correspondente;
- prints com dados sensiveis ocultos.

O prompt sintetico pode aparecer transitoriamente na demonstracao ao vivo, mas nao deve ser salvo como evidencia.

## 17. Evidencias proibidas

Nao capture, copie, publique ou anexe:

- `.env` ou dump de ambiente;
- chave de transporte ou provider key;
- header de autenticacao;
- cookies ou sessao;
- request/response body completo;
- prompt, historico ou resposta bruta de provider;
- contexto ou chunks RAG brutos;
- args/output/schema da tool;
- descriptor/manifest bruto;
- URL interna sensivel;
- connection string;
- stack trace com configuracao;
- tela de terminal que contenha secret, export ou comando privado.

Antes de compartilhar screenshot, recorte ou oculte prompt, dados pessoais, IDs nao descartaveis, URLs privadas e qualquer painel de rede.

## 18. Roteiro de apresentacao interna

1. Explique o objetivo e mostre a arquitetura: Orchestra governa, Agno executa.
2. Mostre o assistant publicado de teste e a policy, sem abrir configuracao sensivel.
3. Envie um Chat simples sintetico com LLM real.
4. Mostre status, runtime `agno_http`, provider logico e persistencia do `AgentRun`.
5. Envie pergunta coberta pela knowledge base de teste.
6. Mostre somente `ragMode`, fontes e caracteres por contadores.
7. Mostre que descriptors foram selecionados pelo Orchestra e que approval/risco bloqueiam por default.
8. Se houver callback real, execute a tool sandbox uma vez e mostre contadores/flags; caso contrario, declare a limitacao e mostre os testes backend 16F.
9. Mostre `externalMcpCalled=false` e os gates de MCP remoto desligados, sem abrir o ambiente completo.
10. Explique que a provider key fica no Agno e a chave descartavel protege o canal server-to-server.
11. Execute ou apresente o rollback e a rotacao planejada.

Nao improvise nova tool, novo provider ou nova policy durante a janela.

## 19. Checklist de demo

Antes:

- [ ] branch e diff revisados;
- [ ] nenhum arquivo de ambiente no worktree;
- [ ] chave descartavel nova nos dois processos;
- [ ] provider key somente no Agno;
- [ ] provider/model/cota aprovados;
- [ ] frontend real, backend, banco e Agno saudaveis;
- [ ] assistant publicado e usuario de teste autorizados;
- [ ] knowledge base sintetica pronta;
- [ ] tool low risk, sem approval e `sandbox_only` pronta;
- [ ] MCP remoto e external tools desligados;
- [ ] preflight offline e health/capabilities aprovados;
- [ ] plano de rollback e responsaveis confirmados.

Durante:

- [ ] Chat simples concluiu e persistiu resposta;
- [ ] runtime `agno_http` e `externalProviderCalled=true` confirmados;
- [ ] RAG mostrou apenas contadores esperados;
- [ ] descriptors mostraram apenas contadores esperados;
- [ ] gateway executou no maximo uma simulacao, se suportado;
- [ ] `externalMcpCalled=false` permaneceu verdadeiro;
- [ ] nenhuma evidencia proibida foi exibida ou gravada.

Depois:

- [ ] rollback aplicado;
- [ ] processos reiniciados/parados;
- [ ] chave descartavel revogada;
- [ ] provider key removida do ambiente local, se nao for mais necessaria;
- [ ] capturas revisadas e redigidas;
- [ ] worktree revisado sem secret ou arquivo local.

## 20. Troubleshooting

### 401 no Agno

As chaves divergem, autenticacao nao foi ativada nos dois lados ou o runtime nao recebeu a variavel. Reinjete a mesma chave sem mostra-la e reinicie ambos. Nao teste imprimindo header.

### 401 no callback

O Agno nao esta usando a chave do canal 16D, o gateway nao esta habilitado ou a chamada chegou a outra configuracao/instancia. Corrija a configuracao privada; nao afrouxe autenticacao.

### Base URL errada ou runtime inacessivel

Confirme a topologia. `127.0.0.1` dentro do container nao e o host. Valide DNS/rede privada e reinicie o backend. Nao publique a URL em captura.

### Runtime local em vez de `agno_http`

Confirme `RUNTIME_PROVIDER=agno_http`, adapter ativo e processo reiniciado. O registry publico deve mostrar somente o provider logico, nunca URL/chave.

### Fallback desligado gera falha

Esse e o comportamento esperado. Corrija Agno/provider; nao ligue fallback silencioso.

### `maxToolCalls=0`

E o baseline 16E/descriptor-only. Para a etapa 16F, mude deliberadamente para um somente depois de confirmar callback e sandbox. Reinicie e rode o preflight 16G.

### Gateway desligado

Nao ha callback. Ative somente na etapa 16F e somente se o Agno suportar o contrato. Caso contrario, permaneça no baseline e declare a limitacao.

### RAG sem fontes

Confirme knowledge readiness, conteudo indexado, binding do assistant e flag RAG. Nao habilite retrieval livre no Agno nem use chunk bruto como diagnostico compartilhado.

### Assistant sem publication

Publique o assistant de teste e confirme que a policy permite modo `published`. Nao use assistant produtivo.

### Provider key ausente no Agno

Injete pelo secret mechanism do Agno e reinicie somente o runtime. Nao copie a key para o Orchestra.

### Tool bloqueada por approval, risco ou binding

Confirme `low`, approval falso em todas as camadas, server trusted, tool ativa e binding `sandbox_only`. Nao reduza policy de uma tool real; crie fixture de teste apropriada.

### Callback perdido apos reinicio do backend

O registry 16F e local e efemero. Encerre a conversa/run, reinicie a demonstracao com nova conversa e garanta afinidade com a mesma instancia. Nao tente recuperar o callback manualmente.

### Secret diferente entre Orchestra e Agno

Descarte ambos os valores e gere uma nova chave unica para a janela. Evite comparar ou imprimir os valores.

### Capabilities contradizem o perfil

Nao prossiga. Ajuste o runtime para anunciar/aplicar exatamente o limite e suportes esperados ou restaure o baseline. O runtime minimo do repo contradiz intencionalmente a demo real.

## 21. Rollback local

Restaure o Orchestra para o baseline local:

```env
RUNTIME_PROVIDER=local
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
MCP_REMOTE_EXECUTION_ENABLED=false
```

Depois:

1. reinicie o backend para aplicar as flags e limpar o registry em memoria;
2. pare ou reinicie o Agno sem a chave descartavel;
3. descarte/rotacione a chave local nos dois lados;
4. remova a provider key do processo/local secret store se nao for mais usar;
5. mantenha MCP remoto e external tools falsos;
6. nao remova volumes nem execute reset destrutivo do banco;
7. confirme que nenhum arquivo local ou secret entrou no Git.

Nao existe migration ou rollback de schema na 16G.

## 22. Criterios de sucesso

A demo completa 16G e bem-sucedida quando:

- preflight offline e health/capabilities autenticados passam;
- frontend envia somente `{ input }`;
- assistant publicado conclui `AgentRun` via `agno_http`;
- Agno chama provider real e a resposta e persistida no Chat;
- RAG usa contexto resolvido pelo Orchestra e expõe somente contadores;
- descriptors sao minimizados e governados;
- se callback estiver no escopo anunciado, exatamente uma tool sandbox e executada pelo gateway 16F;
- `externalMcpCalled=false`, sem shell, MCP remoto ou tool externa;
- nenhuma credencial, body bruto, contexto ou args/output aparece em evidencia;
- rollback e rotacao sao concluidos.

Uma demo reduzida sem callback pode ser aprovada se for rotulada explicitamente como tal. Ela nao comprova o trecho Agno -> gateway 16F.

## 23. Criterios para abortar

Aborte imediatamente se ocorrer qualquer um destes casos:

- chave, provider key, header, cookie ou arquivo de ambiente aparece em tela/log/evidencia;
- health/capabilities retornam payload inesperado ou limite contraditorio;
- runtime exige fallback, acesso ao banco do Orchestra, retrieval livre ou configuracao MCP bruta;
- provider/model nao e o aprovado ou cota nao esta controlada;
- RAG usa dado sensivel ou fonte nao autorizada;
- tool possui approval, risco acima de low, binding diferente de sandbox ou credencial;
- callback chega a instancia errada, perde correlacao ou tenta mais de uma execucao;
- `externalMcpCalled` deixa de ser falso;
- Agno tenta MCP direto, egress de tool, shell ou comando arbitrario;
- resposta/evento/DTO contem prompt, contexto, descriptor, schema, args ou output bruto;
- o time pretende apresentar o fake do repo como Agno/provider real;
- rollback ou rotacao nao estao disponiveis.

Falha fechada e uma evidencia valida. Contornar um gate nao e.

## 24. Validacao de regressao e seguranca

Antes da apresentacao e antes de entregar qualquer diff:

```bash
git status --short
git diff --check
npm --prefix backend run typecheck
npm --prefix backend run test -- --run runtime-smoke-scripts
npm --prefix backend run test -- --run runtime
npm --prefix backend run test -- --run agno
npm --prefix backend run test -- --run runtime-agno-http
npm --prefix backend run test -- --run runtime-tool-gateway
npm --prefix backend run test -- --run agent-runs
npm --prefix backend run test -- --run chat
bash -n scripts/smoke-chat-contexto-15e.sh
bash -n scripts/smoke-chat-provider-real-15h.sh
bash -n scripts/smoke-agno-runtime-security-16d.sh
bash -n scripts/smoke-agno-real-16e.sh
bash -n scripts/smoke-agno-demo-local-16g.sh
```

O `--dry-run` 16G exige variaveis exportadas e uma chave placeholder valida no ambiente de teste. Nao coloque valor no comando versionado nem no documento.

Revise tambem os greps de seguranca definidos para a fase. Ocorrencias devem limitar-se a documentacao negativa, placeholders, testes defensivos e codigo interno sem valor real.

## 25. Limites e riscos remanescentes

- o runtime Agno real nao e fornecido por este repositorio;
- provider behavior, custo e latencia dependem do runtime externo;
- callback, spec ativo, lock e idempotencia 16F sao locais a uma instancia;
- reinicio do backend invalida callbacks pendentes;
- o gateway continua deterministico e nao representa execucao MCP funcional;
- nao ha MCP externo real, approval humano, ledger distribuido, fila ou retry;
- a UI mostra observabilidade allowlisted, nao payload diagnostico bruto;
- Docker exige desenho explicito de rede para Agno no host;
- a demonstracao manual pode persistir mensagens e runs de teste;
- a chave descartavel e a provider key dependem de disciplina operacional fora do Git.

Esses limites nao devem ser ocultados na apresentacao.
