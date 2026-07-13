# Orchestra - Homologacao Segura com Agno Real 16E

## 1. Objetivo

A Fase 16E homologa, em ambiente controlado, o caminho real:

```text
Chat -> AgentRun -> governanca do Orchestra -> agno_http real
     -> Agno runtime -> provider LLM opcional -> resposta persistida no Chat
```

Esta fase entrega procedimento, preflight e evidencias seguras. Ela nao cria funcionalidade produtiva pesada, nao altera `AssistantRuntimeSpecV1`, frontend, Prisma ou migrations e nao habilita execucao real de tool/MCP.

O Chat continua enviando somente `{ input }`. O backend cria o `AgentRun`, resolve policy, contexto conversacional, RAG e descriptors de tools e monta o spec governado. O frontend nunca escolhe runtime, envia credencial ou monta payload para o Agno.

## 2. Arquitetura e responsabilidades

`Orchestra = Control Plane`:

- autentica e autoriza usuario, tenant, workspace e assistant;
- seleciona o runtime e a policy de provider/model;
- resolve e limita contexto conversacional e RAG;
- seleciona e minimiza descriptors de tools;
- fixa limites, aplica precheck, persiste o `AgentRun` e a resposta do Chat;
- normaliza observabilidade e falha fechada.

`Agno = Runtime Executor`:

- autentica o canal server-to-server;
- implementa `/health`, `/capabilities` e `/execute` conforme os contratos V1;
- usa somente o spec recebido;
- chama o provider LLM apenas quando o ambiente e a policy autorizarem;
- devolve resposta contratual minimizada;
- nao faz retrieval livre, discovery de tools, chamada MCP direta ou decisao de governanca.

O Agno nao recebe autoridade para consultar o banco do Orchestra, buscar fontes adicionais ou ampliar os limites do spec.

## 3. Pre-requisitos

Antes da janela de homologacao:

- branch e diff revisados sem material sensivel;
- ambiente de homologacao isolado, acesso minimo e TLS valido;
- runtime Agno real compativel com os contratos V1;
- ingress do Agno restrito ao Orchestra ou ao segmento autorizado;
- redaction de headers e cookies no proxy, APM, backend e Agno;
- nova chave de transporte gerada e armazenada fora do repositorio;
- provider/model e cota aprovados quando houver chamada LLM real;
- assistant publicado de teste com policy coerente;
- dados RAG de teste autorizados e sem informacao sensivel;
- plano de rollback e responsavel pela rotacao definidos;
- tools externas e MCP remoto bloqueados em todas as camadas.

Nao use dados produtivos, assistant de producao ou credencial reutilizada de outro ambiente.

## 4. Variaveis necessarias

Baseline de homologacao no Orchestra:

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_REQUIRE_PRECHECK=true
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES=32768
AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
MCP_REMOTE_EXECUTION_ENABLED=false
```

Preencha base URL e chave somente pelo mecanismo seguro do ambiente. O bloco acima contem placeholders vazios, nao valores copiaveis.

Para RAG, habilite `AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=true` apenas depois de validar readiness, bindings e limites da 16B. Para anexar descriptors, use `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true` somente na etapa especifica da 16C; isso nao autoriza chamadas, pois `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`, `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false` e todos os gates externos permanecem falsos.

A Fase 16F introduz um gateway controlado, mas nao muda este baseline. A homologacao 16E com Agno real continua com tool execution desligada; MCP/tool externo real permanece fora ate fase posterior.

As variaveis devem estar exportadas no processo que executa os smokes. Os scripts nao carregam `.env`.

## 5. Chave de transporte versus key do provider

Sao dominios de credencial separados:

- `AGNO_RUNTIME_HTTP_SECURITY_KEY` autentica o Orchestra perante o Agno;
- a API key do provider autentica o Agno perante o provider LLM;
- a mesma chave de transporte deve ser resolvida nos dois lados do canal;
- a key do provider existe somente no secret manager e no processo do Agno;
- o Orchestra, o browser e `AssistantRuntimeSpecV1` nunca recebem a key do provider.

Nao reutilize uma key de provider como chave de transporte. Rotacao, escopo e auditoria devem ser independentes.

## 6. Configuracao segura do Orchestra

1. Injete a chave nova pelo secret manager, sem valor inline em comando, arquivo versionado ou ticket.
2. Configure URL HTTPS sem userinfo, query ou fragment. HTTP e aceitavel somente em loopback descartavel de desenvolvimento.
3. Ative `agno_http`, o adapter e a autenticacao obrigatoria.
4. Mantenha fallback desabilitado; indisponibilidade do Agno deve falhar fechada.
5. Mantenha todos os gates de execucao externa falsos, `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false` e `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`.
6. Inicie o backend somente depois de revisar redaction e egress.
7. Consulte registry/providers apenas pelo DTO sanitizado. Ele pode mostrar provider logico, `current`, `enabled`, `configured`, health e capabilities; nunca URL, chave, header ou configuracao privada.

Nao habilite tracing de request/response body ou headers durante a homologacao.

## 7. Configuracao segura do Agno

1. Resolva a mesma chave de transporte por secret manager e exija autenticacao nos tres endpoints.
2. Mantenha a key do provider somente no ambiente seguro do Agno.
3. Restrinja provider/model ao conjunto aprovado e aplique timeout/cota do ambiente.
4. Implemente validacao strict dos contratos V1 e correlacao do trace/run recebidos.
5. Anuncie e aplique `maxToolCalls=0`; nao configure MCP remoto, tool executor ou callback de gateway.
6. Consuma RAG apenas de `rag.sources` ja resolvidas pelo Orchestra; nao acesse banco, vector store ou storage do Control Plane.
7. Redija headers, bodies, prompts, contexto, respostas de provider e configuracao em logs/APM.
8. Retorne apenas output funcional, status, usage, eventos e metadata allowlisted.

Se o runtime exigir URL MCP, manifest bruto, credencial de tool ou acesso direto aos dados do Orchestra, ele nao atende a 16E.

## 8. Validacao de health

Execute primeiro os preflights sem rede:

```bash
scripts/smoke-agno-runtime-security-16d.sh --dry-run
scripts/smoke-agno-real-16e.sh --dry-run
```

Na janela autorizada:

```bash
scripts/smoke-agno-real-16e.sh --check-runtime
```

O 16E envia uma requisicao autenticada a `/health`, guarda a resposta em arquivo temporario com permissao restrita, valida JSON, provider logico, versao de protocolo e status `healthy` ou `degraded`, e remove o arquivo ao sair. Ele mostra apenas resultado generico, nunca URL, header, body ou chave.

`degraded` so pode prosseguir se a causa for conhecida, aprovada e nao afetar autenticacao, contrato, governanca ou redaction.

## 9. Validacao de capabilities

O mesmo `--check-runtime` chama `/capabilities` depois do health. A resposta deve:

- declarar provider logico `agno` e uma versao de protocolo;
- declarar como booleanos streaming, tools, RAG, provider externo e file inputs;
- informar limite positivo de input;
- informar `maxToolCalls=0`.

`supportsTools=true` significa suporte contratual a descriptors, nao permissao de execucao. O check nao chama `/execute`, Chat, provider, tool ou MCP e nao exibe a resposta completa.

Depois, valide o registry/providers do Orchestra pelo DTO sanitizado. Provider diferente de `agno_http`, fallback, status incoerente ou campo privado e criterio de aborto.

## 10. Validacao opcional de Chat real

Nao ha `--chat-check` no smoke 16E. Autenticacao de usuario, cookie de sessao, identidade do assistant e persistencia tornam a automacao generica mais arriscada; a verificacao fica manual e explicitamente deliberada.

1. Confirme que 16D dry-run, 16E dry-run e 16E check-runtime passaram.
2. Selecione um assistant publicado criado para teste, com provider/model e policy aprovados.
3. Abra uma conversa nova na UI e envie uma mensagem nao sensivel.
4. Confirme que o request publico do Chat contem somente `{ input }`.
5. Confirme `AgentRun` concluido e runtime `agno_http`.
6. Confirme que a resposta do assistant foi persistida na conversa e vinculada ao run.
7. Confirme provider/model allowlisted e `externalProviderCalled` conforme o ambiente: verdadeiro somente se o Agno realmente chamou o LLM aprovado; falso no modo deterministico/sem provider.
8. Quando RAG estiver habilitado, repita com uma pergunta coberta pelos dados de teste e aplique a secao 12.
9. Quando descriptors estiverem habilitados, aplique a secao 13.
10. Revise DTOs, UI e logs pela lista de evidencias permitidas, encerre a janela e execute rollback ou mantenha o ambiente por decisao registrada.

Nao use DevTools para copiar headers, cookies ou bodies completos. Divergencia entre a chamada externa esperada e `externalProviderCalled` exige investigacao e impede o aceite.

## 11. Como manter `maxToolCalls=0`

O bloqueio deve coincidir em quatro pontos:

- ambiente Orchestra: `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`;
- gateway Orchestra: `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false`;
- spec governado: limite efetivo igual a zero;
- capability do Agno: `maxToolCalls=0`;
- executor Agno: nenhuma tool chamada, mesmo se descriptors forem anexados.

O smoke falha se o env ou a capability remota divergirem. Nao altere temporariamente o valor para testar uma tool. A 16E nao possui approval UI, callback real de gateway nem protocolo de execucao externa seguro.

## 12. Como validar RAG sem fontes brutas

Use uma base e uma pergunta de teste previamente aprovadas. O Orchestra continua fazendo o retrieval oficial e envia somente fontes resolvidas, limitadas e sanitizadas no spec.

Evidencia suficiente:

- `ragMode=resolved_context` quando houver resultado;
- `ragSourceCount` dentro do limite;
- `ragContextChars` dentro do limite;
- `maxRagResults` coerente;
- resposta funcional compativel com o dado de teste;
- status de retrieval e persistencia do run.

Nao anexe excerpts, documento/chunk bruto, prompt, contexto, body de `/execute` ou resposta bruta do provider. Pergunta sem resultado deve seguir a policy governada; erro inesperado de retrieval deve falhar antes do runtime, sem mensagem interna promovida.

## 13. Como validar tools somente como descriptors

Para esta etapa, pode-se habilitar `AGNO_RUNTIME_HTTP_TOOLS_ENABLED=true` com um binding de teste low risk, sem approval e previamente governado. Todos os gates externos continuam falsos.

Aceite apenas os contadores:

- `toolDescriptorCount` coerente, inclusive maior que zero no cenario de descriptor;
- `maxToolCalls=0`;
- `toolCallsExecuted=0`;
- `externalMcpCalled=false`;
- `approvalRequiredCount` quantitativo, quando presente.

Nao exponha nome/ID da tool, schema, descriptor, argumentos, output, manifest, URL ou configuracao MCP. Qualquer tentativa de discovery, conexao MCP ou execucao real aborta a homologacao.

## 14. O que observar na UI

Use somente a observabilidade ja existente:

- status do `AgentRun` e resposta persistida;
- runtime `agno_http`;
- provider/model logicos e `externalProviderCalled`;
- `requestSent` e `failClosed` quando aplicavel;
- contadores de contexto conversacional, RAG, usage e tools;
- `toolCallsExecuted=0` e `externalMcpCalled=false`;
- timestamps da execucao.

A UI nao deve mostrar URL interna, header, credencial, historico bruto, prompt, fonte RAG bruta, payload do runtime ou detalhe de tool.

## 15. O que observar nos logs

Confirme somente status, provider logico, latencia, timestamps, codigos governados e contadores. Verifique que backend, Agno, ingress, proxy e APM aplicam redaction antes de armazenar ou exportar eventos.

Nao aumente o nivel de log para request/response completo. Se qualquer componente registrar header, cookie, URL privada, body, prompt, contexto, key, argumento/output de tool ou stack com configuracao, interrompa, restrinja o artefato e rotacione a credencial exposta.

## 16. Evidencias permitidas

Podem ser anexados:

- commit hash;
- branch;
- status `healthy` ou `degraded`;
- provider logico;
- contadores;
- `requestSent`;
- `failClosed`;
- `toolDescriptorCount`;
- `toolCallsExecuted=0`;
- `externalMcpCalled=false`;
- timestamps;
- prints com secrets ocultos.

Prefira output do smoke, checklist assinado e recortes de UI contendo somente esses campos.

## 17. Evidencias proibidas

Nunca anexe ou copie:

- `.env` ou dump de ambiente;
- headers;
- cookies;
- header `Authorization`;
- provider API key;
- security key;
- body bruto de `/execute`;
- raw prompt;
- raw context;
- tool args ou tool output;
- URLs internas sensiveis;
- stack trace com config.

Tambem nao use screenshot de terminal com historico, secret manager, DevTools Network ou configuracao de deploy visivel.

## 18. Criterios de aceite

- preflights 16D e 16E passam com a configuracao exportada;
- health e capabilities autenticados passam sem revelar material privado;
- registry mostra `agno_http` selecionado, configurado e sem fallback ou campos privados;
- Chat envia somente `{ input }` e o Orchestra monta o spec V1 governado;
- assistant publicado de teste conclui um `AgentRun` no Agno real;
- resposta valida e persistida no Chat;
- provider/model e `externalProviderCalled` condizem com o cenario autorizado;
- RAG, quando ativo, mostra somente contadores coerentes;
- descriptors, quando ativos, resultam em `toolCallsExecuted=0` e `externalMcpCalled=false`;
- logs, DTOs, UI e evidencias nao contem itens proibidos;
- timeout, auth, contrato ou indisponibilidade falham fechados sem runtime local silencioso;
- rollback ou decisao de manter o ambiente foi registrada.

## 19. Criterios para abortar a homologacao

Interrompa imediatamente se ocorrer qualquer um:

- chave ausente, divergente, fraca, exibida ou recusada;
- URL insegura, TLS invalido, autenticacao opcional ou ingress excessivo;
- provider diferente, runtime local inesperado ou fallback habilitado;
- health/capabilities invalidos ou `maxToolCalls` diferente de zero;
- qualquer gate de tool externa/MCP verdadeiro;
- chamada de tool, discovery ou conexao MCP, ainda que a resposta final tenha sucesso;
- RAG livre pelo Agno, fonte fora do spec ou conteudo bruto em observabilidade;
- body, prompt, contexto, header, cookie, URL privada, provider key ou security key em log/DTO/evidencia;
- resposta contratual invalida, trace/run divergente ou persistencia inconsistente;
- `externalProviderCalled` divergente do comportamento autorizado;
- custo, cota, escopo de dados ou responsavel operacional nao aprovados.

Trate qualquer credencial observada como comprometida e inicie a rotacao antes de retomar.

## 20. Rollback

Rollback nao usa fallback automatico:

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_ALLOW_EXTERNAL_TOOLS=false
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=false
AGNO_RUNTIME_HTTP_SECURITY_KEY=
AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED=false
AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false
AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0
AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false
AGNO_ALLOW_EXTERNAL_TOOLS=false
AGNO_ALLOW_REMOTE_MCP=false
MCP_REMOTE_EXECUTION_ENABLED=false
```

Reinicie o backend com a configuracao aprovada, confirme provider local healthy e execute os testes/smokes locais pertinentes. Revogue a chave de homologacao se houve exposicao ou encerramento definitivo; caso contrario, mantenha-a no secret manager somente pelo periodo aprovado. Nao ha migration ou rollback de banco nesta fase.

## 21. Rotacao de chave

O runtime atual aceita uma chave por processo. Procedimento seguro:

1. suspenda ou drene o trafego da janela;
2. gere nova chave no secret manager, sem revela-la em terminal ou artefato;
3. atualize Agno e Orchestra de forma coordenada;
4. reinicie/rotacione instancias;
5. execute 16D dry-run, 16E dry-run e 16E check-runtime;
6. confirme ausencia de 401, campos privados e fallback;
7. revogue a versao anterior;
8. registre somente versao/identificador permitido, timestamp e resultado.

Nao desabilite autenticacao para evitar indisponibilidade. Rotacao com duas chaves, vault integration e provider key manager continuam fora desta fase.

## 22. Checklist final

- [ ] branch/diff revisados e sem segredo real;
- [ ] ambiente isolado, TLS, ingress e redaction aprovados;
- [ ] chave nova criada fora do repositorio e resolvida nos dois processos;
- [ ] key do provider existe somente no Agno;
- [ ] `RUNTIME_PROVIDER=agno_http` e adapter habilitado;
- [ ] fallback desabilitado;
- [ ] autenticacao do runtime obrigatoria;
- [ ] `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0` no Orchestra, spec e capability;
- [ ] `AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false` na homologacao 16E;
- [ ] gates de tools externas e MCP falsos;
- [ ] smoke 16D `--dry-run` aprovado;
- [ ] smoke 16E default/`--dry-run` aprovado sem rede;
- [ ] smoke 16E `--check-runtime` aprovado somente em health/capabilities;
- [ ] registry/providers sanitizado;
- [ ] assistant publicado de teste e policy aprovados;
- [ ] Chat enviou somente `{ input }`;
- [ ] resposta do Agno real persistida e vinculada ao `AgentRun`;
- [ ] runtime, provider/model e chamada externa coerentes;
- [ ] RAG validado somente por contadores, se habilitado;
- [ ] descriptors validados com zero chamadas e sem MCP externo, se habilitados;
- [ ] UI, DTOs, logs e evidencias sem conteudo proibido;
- [ ] criterios de aceite atendidos e nenhum criterio de aborto ativo;
- [ ] rollback executado ou permanencia do ambiente formalmente decidida;
- [ ] plano de rotacao/revogacao concluido.

Permanecem fora da 16E: execucao real de tools/MCP, approval UI, habilitacao do callback 16F em homologacao real, registry persistido em banco, tela nova, streaming, multi-runtime dinamico, rotação com duas chaves, provider key manager, vault integration e agentes on-premise adicionais.
