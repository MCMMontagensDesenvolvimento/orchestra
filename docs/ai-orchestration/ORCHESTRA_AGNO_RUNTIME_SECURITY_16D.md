# Orchestra - Seguranca do Runtime Agno HTTP 16D

## 1. Objetivo

A Fase 16D endurece a comunicacao server-to-server:

```text
Orchestra backend -> agno_http -> Agno runtime
```

O objetivo e preparar homologacao e producao sem credenciais versionadas, URLs ambiguas, configuracao privada em DTOs ou logs e sem fallback silencioso. Os testes e o preflight desta fase nao chamam Agno real, provider LLM real, tool ou MCP real.

## 2. Arquitetura e responsabilidades

O Orchestra permanece o Control Plane. Ele seleciona runtime, provider/model autorizados, contexto RAG, descriptors MCP, limites, policy, precheck, auditoria e observabilidade.

O Agno permanece o Runtime Executor. Ele recebe a `AssistantRuntimeSpecV1` governada, executa somente o que o contrato e a policy permitem e devolve uma resposta contratual minimizada.

A chave de transporte autentica o canal Orchestra -> Agno. Ela nao transfere ao Agno autoridade para escolher policy, consultar dados livremente ou executar tools fora do gateway governado.

## 3. Secret interna Orchestra -> Agno

A variavel oficial e:

```env
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

Quando configurada, ela e enviada exclusivamente no header server-to-server:

```text
Authorization: Bearer <valor-resolvido-no-ambiente-seguro>
```

A chave nao entra no body de `/execute`, `AssistantRuntimeSpecV1`, metadata, eventos, resposta publica ou mensagem de erro. O client rejeita uma resposta remota que ecoe a chave ou a base URL configurada.

Gere material novo com um secret manager ou, em uma estacao administrativa segura:

```bash
openssl rand -hex 32
```

Armazene o resultado em vault, secret manager, variavel protegida da plataforma ou arquivo local ignorado pelo Git. Nunca copie o valor para issue, Chat, documento, log, screenshot ou comando versionado.

O valor deve ter entre 16 e 512 caracteres e usar formato seguro de bearer token. O valor hexadecimal de 64 caracteres produzido pelo comando recomendado atende a regra.

## 4. Secret de transporte versus keys de provider

Sao credenciais diferentes e com ciclos de vida independentes:

- `AGNO_RUNTIME_HTTP_SECURITY_KEY` autentica o Orchestra perante o runtime Agno;
- keys de OpenAI, Azure OpenAI, Anthropic ou outro provider autenticam o Agno perante o provider;
- keys de provider ficam somente no ambiente seguro do Agno real;
- o Orchestra nao envia keys de provider no contrato `agno_http`;
- o frontend nao recebe nenhuma dessas credenciais.

Comprometer uma credencial exige rotacionar somente o dominio afetado, salvo evidencia de comprometimento conjunto.

## 5. Configuracao local e desenvolvimento

O baseline sem rede permanece:

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=false
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

Para o runtime minimo isolado, e permitido deixar a chave ausente. Ainda assim, usar uma chave fake local exportada nos dois processos permite validar autenticacao sem provider externo:

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=http://127.0.0.1:8091
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

Preencha o ultimo valor somente fora dos arquivos versionados. O runtime minimo e deterministico: nao chama provider, tool, MCP ou banco externo.

## 6. Configuracao de homologacao

Em homologacao, a autenticacao deve ser obrigatoria:

```env
RUNTIME_PROVIDER=agno_http
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
RUNTIME_REQUIRE_PRECHECK=true
AGNO_RUNTIME_HTTP_ENABLED=true
AGNO_RUNTIME_HTTP_BASE_URL=https://runtime-agno.homologacao.example
AGNO_RUNTIME_HTTP_TIMEOUT_MS=15000
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

Resolva a chave por secret manager. Confirme que o runtime recebe o mesmo valor e protege `/health`, `/capabilities` e `/execute`. Use `scripts/smoke-agno-runtime-security-16d.sh --dry-run` antes de qualquer acesso de rede e `--check` apenas na janela de homologacao autorizada.

O `--check` chama somente `/health`. Ele nao envia Chat, nao chama `/execute` e nao aciona provider ou tool.

## 7. Configuracao de producao

Producao segue as regras de homologacao, com requisitos adicionais:

- HTTPS com certificado valido e verificacao TLS habilitada;
- chave exclusiva por ambiente, com acesso minimo e auditoria no secret manager;
- `AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true`;
- `RUNTIME_ALLOW_PROVIDER_FALLBACK=false`;
- ingress do Agno restrito ao backend/segmento autorizado;
- rotacao periodica e imediata apos qualquer suspeita de exposicao;
- logs com redaction de headers no proxy, load balancer, APM e runtime;
- health remoto sem detalhes arbitrarios ou configuracao operacional.

HTTP sem TLS deve ficar restrito a loopback ou rede local descartavel de desenvolvimento.

## 8. Regras de URL segura

`AGNO_RUNTIME_HTTP_BASE_URL`:

- e obrigatoria quando `AGNO_RUNTIME_HTTP_ENABLED=true`;
- aceita apenas `http` ou `https`;
- exige host valido;
- rejeita usuario ou senha embutidos;
- rejeita query string, inclusive vazia;
- rejeita fragment, inclusive vazio;
- remove barras finais antes de formar os endpoints;
- nunca e devolvida no provider list ou no DTO publico de configuracao.

Exemplos rejeitados:

```text
ftp://runtime.example
https://user:password@runtime.example
https://runtime.example?tenant=internal
https://runtime.example#private
```

O timeout aceito por `AGNO_RUNTIME_HTTP_TIMEOUT_MS` vai de 1.000 a 120.000 ms. Valores fora da faixa impedem a inicializacao da configuracao.

## 9. Headers e autenticacao

O client adiciona o header de autenticacao somente quando a chave esta configurada. O mesmo caminho interno e usado por:

- `GET /health`;
- `GET /capabilities`;
- `POST /execute`.

O runtime minimo compara o valor configurado sem registrar o header. Com chave configurada, ausencia ou divergencia retorna HTTP 401 com mensagem generica. Sem chave, o modo local continua disponivel para desenvolvimento isolado.

Nao habilite tracing de request headers nesses endpoints. Se a plataforma coleta headers por default, aplique redaction antes da homologacao.

## 10. Health e capabilities autenticados

O registry chama health e capabilities pelo mesmo client autenticado usado no execute. As respostas passam pelos schemas strict e por normalizacao local.

O health publico do `agno_http` mostra status, mensagem local generica, timestamp e somente detalhes allowlisted. Mensagem arbitraria do runtime, base URL, header e chave nao sao promovidos.

O provider list mostra:

- identificador do provider;
- `current`;
- `enabled`;
- `configured`;
- health resumido;
- capabilities normalizadas.

Ele nao mostra base URL, chave, header ou objeto de configuracao do client.

## 11. Rotacao de chave

Procedimento recomendado com suporte a duas chaves no runtime/proxy:

1. gere uma nova chave no secret manager;
2. adicione a nova chave ao conjunto aceito pelo runtime, mantendo a anterior temporariamente;
3. atualize o secret consumido pelo Orchestra e reinicie/rotacione as instancias;
4. execute o preflight `--check` e valide health/capabilities pelo backend;
5. confirme erros 401 ausentes e ausencia de fallback;
6. remova a chave anterior do runtime;
7. revogue e marque a versao antiga no secret manager;
8. registre somente IDs de versao, timestamps e resultado, nunca valores.

O runtime minimo desta base aceita uma chave por processo. Sem suporte operacional a sobreposicao, use uma janela controlada: interrompa trafego, altere runtime e Orchestra de forma coordenada, valide e retome. Nao enfraqueca a autenticacao para evitar indisponibilidade.

Se um valor real apareceu em terminal, log, CI, Chat, issue ou artefato, considere-o comprometido e rotacione imediatamente.

## 12. O que nunca logar

Nunca registre:

- valor de `AGNO_RUNTIME_HTTP_SECURITY_KEY`;
- qualquer header de autenticacao ou cookie;
- keys de provider;
- arquivo de ambiente ou dump de `process.env`;
- base URL com credenciais;
- body bruto de provider, prompt bruto, contexto bruto ou resposta bruta;
- argumentos ou output bruto de tool/MCP;
- stack que incorpore request config.

Logs aceitos usam apenas status, provider logico, contadores, latencia, hashes, IDs operacionais e codigos de erro governados.

## 13. O que nunca commitar

Nao versione:

- arquivos locais de ambiente;
- valores de secret, token ou cookie;
- manifests de deploy com credencial inline;
- exemplos preenchidos;
- fixtures copiadas de producao;
- saidas de debug contendo headers.

`backend/.env.example` contem somente placeholder vazio para a chave e defaults nao sensiveis.

## 14. Como validar sem expor segredo

Valide primeiro sem rede:

```bash
scripts/smoke-agno-runtime-security-16d.sh --dry-run
```

O script usa somente variaveis ja exportadas, informa presenca/ausencia da credencial sem mostrar o valor, valida URL, flags e timeout e nao carrega arquivo local de ambiente.

Na homologacao autorizada:

```bash
scripts/smoke-agno-runtime-security-16d.sh --check
```

O check faz no maximo uma chamada a `/health`, guarda a resposta em arquivo temporario restrito, valida JSON/status e remove o arquivo ao sair. Nao use shell tracing. Nao copie o comando com valor inline para historico.

Os testes automatizados usam apenas fetch/supertest fakes e o runtime minimo deterministico. Eles nao dependem de `.env`, internet ou credencial real.

## 15. Rollback

Rollback seguro para o caminho local:

```env
RUNTIME_PROVIDER=local
RUNTIME_ADAPTER_ENABLED=true
RUNTIME_ALLOW_PROVIDER_FALLBACK=false
AGNO_RUNTIME_HTTP_ENABLED=false
AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=false
AGNO_RUNTIME_HTTP_SECURITY_KEY=
```

Reinicie o backend com a configuracao aprovada e confirme provider `local` healthy. Nao habilite fallback automatico como mecanismo de rollback. Preserve a chave anterior no secret manager somente pelo periodo exigido para investigacao/rollback e depois revogue.

## 16. Riscos residuais

- um proxy pode registrar headers antes da aplicacao se redaction nao estiver configurada;
- HTTP fora de loopback expoe credencial e payload em transito;
- runtime externo malicioso pode tentar devolver dados sensiveis; schemas, allowlists e deteccao da configuracao conhecida reduzem, mas nao substituem isolamento;
- rotacao de chave unica pode causar indisponibilidade curta;
- health/capabilities remotos podem ficar indisponiveis e o registry deve reportar falha, nunca trocar silenciosamente de runtime;
- habilitar tools ou RAG alem dos limites da 16B/16C exige nova governanca; esta fase nao cria execucao MCP real.

## 17. Checklist de homologacao

- [ ] branch e diff revisados sem credencial real;
- [ ] `RUNTIME_PROVIDER=agno_http` e adapter habilitado;
- [ ] fallback de provider desabilitado;
- [ ] base URL HTTPS sem userinfo, query ou fragment;
- [ ] timeout entre 1.000 e 120.000 ms;
- [ ] autenticacao obrigatoria habilitada;
- [ ] chave gerada fora do repositorio e resolvida por secret manager;
- [ ] mesma versao da chave ativa no Orchestra e no Agno;
- [ ] redaction de headers confirmada em proxy/APM/runtime;
- [ ] `--dry-run` aprovado sem imprimir valores;
- [ ] `--check` aprovado chamando somente health;
- [ ] health e capabilities autenticados;
- [ ] provider list sem URL, chave ou headers;
- [ ] `/execute` testado apenas com fake em automacao;
- [ ] runtime local preservado;
- [ ] RAG 16B permanece resolvido pelo Orchestra;
- [ ] tools 16C permanecem descriptors governados e sem execucao real no fake;
- [ ] plano de rotacao e rollback aprovado;
- [ ] nenhuma evidencia sensivel anexada ao ticket de homologacao.
