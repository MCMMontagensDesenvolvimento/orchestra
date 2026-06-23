# Orchestra - Fechamento da Sprint 18: Dados Reais e Mock Mode Controlado

Fase 09F / Sprint 18

## Resumo Executivo

A Sprint 18 consolidou a transicao do Orchestra de uma experiencia com forte presenca de dados demonstrativos para um caminho operacional em que mock mode e explicito, dados reais sao priorizados e ambientes production-like falham fechados.

As fases 09A a 09E foram concluidas e mergeadas na `main`. O resultado e uma base apta para encerramento da sprint:

- mock mode opt-in e restrito a ambientes permitidos;
- bootstrap real separado de seed demo;
- frontend real sem fallback implicito para dados falsos nos pontos criticos;
- smoke fullstack reproduzivel com frontend, backend e PostgreSQL reais;
- documentacao operacional para execucao, diagnostico e continuidade.

O fechamento nao afirma que todos os dominios futuros estao implementados. Chat real, Analytics consolidado, RAG semantico, MCP remoto e observabilidade avancada permanecem fora do escopo e nao bloqueiam o encerramento desta sprint.

## Objetivo da Sprint

Estabelecer uma fronteira operacional confiavel entre dados reais persistidos, providers locais/deterministicos governados, dados mock/demo usados somente com opt-in, fixtures de testes e funcionalidades futuras apresentadas como prototipo ou indisponiveis.

## Entregas por Fase

### 09A - Auditoria de Dados Reais, Mocks e Seeds

- Inventario de variaveis, datasets mock, services, frontend, backend, seeds e scripts.
- Classificacao de dados reais, demonstrativos e test doubles.
- Politica recomendada por ambiente.
- Registro dos riscos de mock acidental, seed demo e aparencia de dado real.

### 09B - Guardrails de Mock Mode

- `VITE_USE_MOCKS` tornou-se opt-in.
- Valor ausente, vazio, falso ou invalido mantem mocks desligados.
- Mock mode e permitido somente em ambientes locais, de teste ou prototipo reconhecidos.
- Staging, homologacao, producao e ambientes desconhecidos bloqueiam solicitacao de mock mode.
- `ProtectedRoute` nao ignora sessao fora de mock mode permitido.
- Testes frontend deixaram de depender do `.env` local.

### 09C - Bootstrap Real e Seed Demo

- Seed padrao passou a executar bootstrap real e idempotente.
- Bootstrap cria tenant, workspace, admin local, roles, permissions e vinculos necessarios.
- Dados demo exigem opt-in separado e sao bloqueados em production-like.
- Bootstrap nao cria identidade Microsoft artificial.
- 09C foi mergeada na `main`.

### 09D - API Real sem Fallback Implicito

- Services criticos mantem API real quando mocks estao desligados.
- Erros de API nao sao convertidos silenciosamente em datasets demo.
- Dashboard real usa somente fontes reais disponiveis.
- Detalhe de Assistant nao substitui falha por outro registro da listagem.
- Chat e Analytics sem contrato real exibem estados explicitos de prototipo ou indisponibilidade.
- Timeline demonstrativa de Knowledge fica restrita ao mock mode.
- 09D foi mergeada na `main`.

### 09E - Smoke Fullstack com Dados Reais

- Criado smoke reproduzivel para `frontend`, `backend` e `db`.
- Validados healthchecks, banco, migrations, bootstrap, frontend real e configuracao SSO sanitizada.
- Endpoints autenticados foram exercitados com dev-login local controlado.
- O smoke nao cria dados de negocio e aceita catalogos vazios.
- Flags de demo sao forcadas para falso durante o bootstrap.
- O contador do Assistant demo e comparado antes/depois.
- Evidencia executada: `27 PASS, 0 SKIPPED, 0 FAIL`.
- 09E foi mergeada na `main`, que estava limpa no inicio da 09F.

## Evidencias Tecnicas

| Evidencia | Status | Referencia |
| --- | --- | --- |
| Mock mode e opt-in | Concluido | `frontend/src/lib/env.ts` e atualizacao 09B da auditoria |
| Production-like bloqueia mock solicitado | Concluido | Guardrails 09B e testes de ambiente |
| Seed real separado de seed demo | Concluido | `ORCHESTRA_BOOTSTRAP_E_SEEDS.md` |
| Bootstrap real idempotente | Concluido | Seed com upserts e validacoes 09C/09E |
| Seed demo opt-in e bloqueado em production-like | Concluido | Politica de seed 09C |
| Frontend real sem fallback implicito nos pontos criticos | Concluido | Atualizacao 09D da auditoria |
| Chat/Analytics futuros nao fingem dados reais | Concluido | Estados explicitos da 09D |
| Smoke fullstack real reproduzivel | Concluido | `scripts/smoke-fullstack-real.sh` |
| Smoke executado com sucesso | Concluido | `27 PASS, 0 SKIPPED, 0 FAIL` |
| 09C, 09D e 09E integradas | Concluido | Historico da `main` no fechamento 09F |

## Criterios de Aceite

- [x] Auditoria de mocks, dados reais, seeds e fixtures concluida.
- [x] Mock mode desligado por padrao e ativado somente por opt-in.
- [x] Mock mode bloqueado em staging, homologacao, producao e ambiente desconhecido.
- [x] Autenticacao protegida nao e ignorada fora do mock mode permitido.
- [x] Bootstrap real separado do seed demo.
- [x] Bootstrap padrao nao depende de Assistant ou fixture demo.
- [x] Seed demo bloqueado em production-like.
- [x] Frontend real nao mascara falha critica com dados demo.
- [x] Funcionalidades sem API real sao apresentadas honestamente.
- [x] Smoke fullstack valida frontend, backend, banco, migrations e bootstrap.
- [x] Smoke valida endpoints publicos e autenticados quando permitido.
- [x] Smoke nao depende de SSO Microsoft interativo.
- [x] Smoke nao chama provider externo.
- [x] Evidencia 09E concluida com `27 PASS, 0 SKIPPED, 0 FAIL`.
- [x] Runbooks operacionais criados e indexados.
- [x] Nenhum valor real de segredo foi documentado.

## Validacao Local

1. Subir e conferir a stack:

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml ps
```

2. Confirmar no frontend:

```dotenv
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

3. Executar:

```bash
bash scripts/smoke-fullstack-real.sh
```

Resultado de referencia:

```text
Smoke summary: PASS=27 SKIPPED=0 FAIL=0
RESULT PASS
```

`SKIPPED` e aceitavel para checks autenticados quando dev-login estiver desabilitado. Nesse caso, a sessao deve ser validada manualmente por SSO real.

4. Validar navegacao por Login, Dashboard, Assistants, Knowledge, MCP, catalogo LLM e Runtime. Confirmar que Chat e Analytics exibem estado explicito quando ainda sem contrato real.

## Validacao Futura em Homologacao e Producao

1. Fixar ambiente production-like reconhecido.
2. Garantir mock mode desligado e bloqueado no build.
3. Manter dev-login desabilitado.
4. Aplicar migrations por processo controlado.
5. Executar somente bootstrap permitido, sem seed demo.
6. Configurar SSO Microsoft real e validar conta/tenant permitidos.
7. Armazenar secrets somente no backend ou secret manager.
8. Executar o smoke sem dev-login, aceitando checks autenticados como `SKIPPED`.
9. Completar checks autenticados por sessao SSO e navegacao manual.
10. Confirmar providers externos desabilitados ate aprovacao operacional.
11. Registrar evidencias de health, migrations, login, RBAC e auditoria.

O smoke local nao substitui homologacao de SSO, RBAC, CORS, cookies seguros, TLS, secret manager, backup, restore ou observabilidade do ambiente alvo.

## Pendencias Conhecidas

- Chat real ainda nao possui contrato backend completo.
- Analytics consolidado e custos reais ainda nao possuem API dedicada.
- Algumas queries secundarias podem receber tratamento de erro mais granular.
- Permanecem nomes locais `mock...` em areas secundarias, sem fallback funcional no recorte critico.
- Pode haver dado demo preexistente em bancos locais antigos; o smoke comprova que o bootstrap real nao o cria nem usa.
- O smoke de ambiente superior ainda precisa de estrategia autenticada sem dev-login.
- Verificacao CI para impedir mock em builds production-like continua recomendada.
- Providers externos exigem enablement governado, secrets e evidencias especificas antes de uso.

## Proximas Fases

### Fase 10 / Sprint 13 - RAG Semantico e Vector Store

Embeddings governados, vector store, retrieval semantico, relevancia e citacoes.

### Fase 11 / Sprint 14 - MCP Remoto Real Governado

Conexao remota, autenticacao, health, descoberta, allowlists, approvals, sandbox e auditoria externa.

### Fase 12 / Sprint 16 - Observabilidade, Custos e Limites

Metricas, custos, budgets, traces, alertas, limites e API real para Analytics.

### Fase 13 - Avaliacao Automatica de Qualidade

Datasets, graders, regressao e criterios de seguranca, fidelidade e utilidade.

### Fase 14 / Sprint 17 - Hardening, Homologacao e Piloto

Promocao controlada, SSO/RBAC no ambiente alvo, CI/CD, incidentes e piloto governado.

## Riscos Residuais

| Risco | Tratamento atual | Proxima acao |
| --- | --- | --- |
| Mock ativado por configuracao incorreta | Fail-closed em production-like | Checagem obrigatoria em CI/CD |
| Dados demo preexistentes em banco local | Bootstrap nao cria nem depende deles | Limpeza governada quando necessario |
| Funcionalidade visual confundida com real | Estados explicitos para Chat/Analytics | Implementar contratos futuros |
| SSO nao exercitado automaticamente no smoke local | Runbook manual e smoke opt-in | Validacao em homologacao |
| Provider externo habilitado sem governanca | Backend-only e flags fail-closed | Change control e observabilidade |
| Ausencia de metricas/custos reais | Nao exibir dados ficticios | Fase 12 / Sprint 16 |
| RAG/MCP externos ainda incompletos | Modos locais/sandbox controlados | Fases 10 e 11 |

## Decisao de Fechamento

**Decisao:** Sprint 18 apta para fechamento.

As entregas planejadas de controle de mock mode, separacao de seeds, honestidade do frontend e validacao fullstack real foram concluidas. As evidencias sustentam o encerramento sem afirmar prontidao produtiva de funcionalidades futuras.

**Proxima fase recomendada:** Fase 10 / Sprint 13, RAG semantico e vector store, mantendo os guardrails estabelecidos nesta sprint.

Nao devem bloquear o encerramento:

- Chat real ainda indisponivel;
- Analytics consolidado ainda indisponivel;
- RAG semantico e vector store;
- MCP remoto real;
- observabilidade e custos avancados;
- avaliacao automatica;
- homologacao e piloto.

Esses itens pertencem ao roadmap posterior e devem entrar com contratos, seguranca e evidencias proprias.
