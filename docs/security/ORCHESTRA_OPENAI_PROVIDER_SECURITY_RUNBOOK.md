# Orchestra OpenAI Provider Security Runbook

Status: handoff operacional atualizado na Fase 07E-C.

## Visao Geral

OpenAI e tratado no Orchestra como provider LLM governado pelo backend. Ele nao e runtime provider e nao deve ser chamado pelo frontend. O caminho seguro e:

1. frontend consulta APIs sanitizadas do backend;
2. backend aplica env/config global, execution policy do assistant, sandbox e RBAC;
3. runtime resolve o provider LLM permitido;
4. provider OpenAI real so executa quando todas as camadas estao opt-in.

O default seguro permanece `local_deterministic`.

## Regras de Seguranca

- OpenAI fica desabilitado por padrao.
- Provider externo e fail-closed por padrao.
- Segredo fica somente no backend/env.
- Frontend nunca chama OpenAI, Azure OpenAI, Anthropic ou qualquer provider externo diretamente.
- Sandbox bloqueia provider real quando `sandboxBlocksRealProviders=true`.
- Nao armazenar prompt bruto nem output bruto.
- Logs, audit e AgentRun devem usar hashes, previews limitados, status e metadata sanitizada.
- Nunca colar API keys em issues, docs, prints, logs ou payloads de teste.

## Variaveis de Ambiente

Nomes confirmados em `backend/src/config/env.ts`:

```env
LLM_PROVIDERS_ENABLED=false
LLM_DEFAULT_PROVIDER=local_deterministic
LLM_EXECUTION_ENABLED=false
LLM_PROVIDER_TIMEOUT_MS=30000
LLM_MAX_INPUT_PREVIEW_CHARS=500
LLM_MAX_OUTPUT_PREVIEW_CHARS=800
LLM_STORE_RAW_PROMPTS=false
LLM_STORE_RAW_OUTPUTS=false

OPENAI_ENABLED=false
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=
OPENAI_EXECUTION_ENABLED=false
```

Nao foram encontrados no parser atual:

- `OPENAI_MODEL`: usar `OPENAI_DEFAULT_MODEL`.
- `OPENAI_TIMEOUT_MS`: usar `LLM_PROVIDER_TIMEOUT_MS`.
- `OPENAI_MAX_TOKENS`: se aplicavel, criar contrato antes de usar.
- `OPENAI_TEMPERATURE`: se aplicavel, criar contrato antes de usar.

Qualquer variavel presente apenas em `.env.example` e ausente de `backend/src/config/env.ts` deve ser tratada como pendencia ate ser suportada pelo parser real.

## Validar Provider Local Deterministic

1. Manter defaults seguros:
   - `LLM_DEFAULT_PROVIDER=local_deterministic`
   - `LLM_PROVIDERS_ENABLED=false`
   - `LLM_EXECUTION_ENABLED=false`
2. Autenticar no backend.
3. Consultar `GET /api/v1/llm/providers`.
4. Confirmar `local_deterministic` como provider atual ou disponivel, sem credenciais externas.
5. Executar `POST /api/v1/llm/test-generation` com `provider=local_deterministic`.
6. Confirmar resposta sanitizada, sem prompt bruto, output bruto ou secrets.

## Validar OpenAI Configurado Sem Expor Segredo

Nunca valide com `echo OPENAI_API_KEY` ou exibindo env real.

1. Configurar segredo apenas no ambiente do backend.
2. Configurar `OPENAI_DEFAULT_MODEL`.
3. Habilitar flags em ambiente controlado:
   - `LLM_PROVIDERS_ENABLED=true`
   - `LLM_EXECUTION_ENABLED=true`
   - `OPENAI_ENABLED=true`
   - `OPENAI_EXECUTION_ENABLED=true`
4. Consultar `GET /api/v1/llm/config`.
5. Verificar somente flags sanitizadas:
   - `openaiEnabled=true`
   - `openaiConfigured=true`
   - `openaiExecutionEnabled=true`
   - `openaiDefaultModelConfigured=true`
6. Consultar `GET /api/v1/llm/providers`.
7. Confirmar que o retorno contem status/capabilities e nunca contem API key, Authorization header ou token.

## Validar Test Generation OpenAI Opt-In

1. Garantir que OpenAI esta configurado e habilitado no backend.
2. Garantir permissao de teste LLM para o usuario.
3. Enviar `POST /api/v1/llm/test-generation` com `provider=openai` em ambiente controlado.
4. Validar:
   - sucesso apenas quando config global permite;
   - erro governado quando provider esta desabilitado, mal configurado ou sem execucao;
   - resposta sem prompt bruto e sem output bruto;
   - logs sem secrets.

Resultado esperado em modo fail-closed: bloqueio com erro governado, sem chamada externa efetiva quando qualquer precondicao falha.

## Editar Policy LLM Por Assistant

A UI de edicao controlada fica no detalhe do assistant, aba Governanca, secao `Governanca LLM`.

Fluxo para permitir OpenAI por assistant:

1. Abrir a secao `Governanca LLM`.
2. Clicar em `Editar policy LLM`.
3. Habilitar provider externo.
4. Habilitar OpenAI.
5. Escolher `openai` como provider default quando o objetivo for usar OpenAI nesse assistant.
6. Salvar.
7. Confirmar que a UI mostra `OpenAI permitido por policy`.

Fluxo para limpar/desabilitar OpenAI:

1. Clicar em `Editar policy LLM`.
2. Usar `Limpar OpenAI` ou desligar provider externo.
3. Salvar.
4. Confirmar que:
   - `allowExternalLlmProviders=false`;
   - `allowedLlmProviders=[]`;
   - `defaultLlmProvider=null`;
   - a UI mostra `OpenAI bloqueado por policy`.

Guardrails da UI:

- nao permite inserir API key ou segredo;
- nao chama OpenAI diretamente;
- nao permite `defaultLlmProvider=openai` sem incluir `openai` na allowlist;
- ao desligar provider externo, limpa allowlist e default externo;
- se `sandboxBlocksRealProviders=true`, sinaliza que sandbox continua bloqueando provider real.

## Validar AgentRun Com OpenAI Opt-In

1. Confirmar config global OpenAI habilitada.
2. Confirmar execution policy do assistant via `GET /api/v1/assistants/:assistantId/execution-policy`.
3. Policy minima esperada para opt-in:
   - `allowExternalLlmProviders=true`
   - `allowedLlmProviders` contem `openai`
   - `defaultLlmProvider=openai`
   - `isExecutionEnabled=true`
   - modo de execucao permitido para o run
4. Executar AgentRun apenas em ambiente controlado e autorizado.
5. Conferir eventos/metadados:
   - provider resolvido;
   - status governado;
   - hashes/previews limitados;
   - ausencia de prompt bruto, output bruto e secrets.

## Validar Que Sandbox Bloqueia Provider Real

1. Usar assistant com sandbox ativo.
2. Confirmar policy:
   - `sandboxEnabled=true`
   - `sandboxBlocksRealProviders=true`
   - `sandboxBlocksExternalTools=true`
3. Executar precheck/AgentRun em modo sandbox.
4. Esperar bloqueio de provider real ou fallback seguro conforme contrato vigente.
5. Confirmar que nenhuma chamada OpenAI real foi feita.
6. Confirmar eventos/audit com motivo sanitizado.

## Troubleshooting

### API key ausente

Sinais:

- `openaiConfigured=false`;
- status `misconfigured`;
- erro governado de provider mal configurado.

Acao: configurar segredo somente no backend/env e reiniciar o backend. Nao registrar o valor em logs.

### Provider desabilitado

Sinais:

- `LLM_PROVIDERS_ENABLED=false`;
- `OPENAI_ENABLED=false`;
- status `disabled`.

Acao: habilitar flags apenas em ambiente controlado.

### Policy nao permite OpenAI

Sinais:

- `allowExternalLlmProviders=false`;
- `allowedLlmProviders` vazio ou sem `openai`;
- `defaultLlmProvider` nulo ou diferente de `openai`.

Acao: usar a edicao controlada em `Governanca LLM` para permitir OpenAI somente quando o ambiente e o assistant estiverem autorizados.

### Sandbox ativo

Sinais:

- `sandboxEnabled=true`;
- `sandboxBlocksRealProviders=true`.

Acao: confirmar que o bloqueio e esperado. Nao contornar sandbox em producao.

### Timeout

Sinais:

- erro governado de timeout;
- latencia alta em metadata sanitizada.

Acao: revisar `LLM_PROVIDER_TIMEOUT_MS`, rede, quota e status upstream sem expor payload.

### 401/403

Sinais:

- 401: sessao ausente/invalida;
- 403: permissao insuficiente.

Acao: validar autenticacao e RBAC. Nao relaxar permissao globalmente.

### 429

Sinais:

- erro `OPENAI_RATE_LIMITED` ou equivalente sanitizado.

Acao: reduzir volume, revisar quota, retry/backoff operacional. Nao logar payload bruto.

### 5xx

Sinais:

- erro upstream indisponivel ou falha inesperada.

Acao: fail-closed, revisar status do provider, manter fallback local quando aplicavel.

## Checklist Antes de Habilitar em Ambiente Controlado

- `npm run typecheck`, `npm run test` e `npm run build` passam.
- `npm audit --audit-level=high` sem vulnerabilidades altas.
- `LLM_STORE_RAW_PROMPTS=false`.
- `LLM_STORE_RAW_OUTPUTS=false`.
- `OPENAI_API_KEY` configurada somente no backend/env.
- `OPENAI_DEFAULT_MODEL` definido.
- `LLM_PROVIDERS_ENABLED=true` somente no ambiente alvo.
- `LLM_EXECUTION_ENABLED=true` somente no ambiente alvo.
- `OPENAI_ENABLED=true` somente no ambiente alvo.
- `OPENAI_EXECUTION_ENABLED=true` somente no ambiente alvo.
- Assistant policy permite explicitamente OpenAI.
- Sandbox nao esta ativo para o run real, ou bloqueio de provider real e esperado.
- Logs e audit inspecionados sem secrets.
- Frontend validado sem chamada direta a OpenAI.

## Checklist de Rollback / Desativacao

- Definir `OPENAI_EXECUTION_ENABLED=false`.
- Definir `OPENAI_ENABLED=false` se a visibilidade do provider tambem deve ser removida.
- Definir `LLM_EXECUTION_ENABLED=false` para bloqueio global.
- Retornar `LLM_DEFAULT_PROVIDER=local_deterministic`.
- Limpar policy do assistant na fase propria de edicao controlada:
  - `allowExternalLlmProviders=false`;
  - `allowedLlmProviders=[]`;
  - `defaultLlmProvider=null`.
- Confirmar `GET /api/v1/llm/config` sanitizado com execucao externa bloqueada.
- Confirmar `GET /api/v1/assistants/:assistantId/execution-policy` sem opt-in OpenAI.
- Confirmar AgentRun bloqueado ou usando provider local.
- Revisar logs sem secrets.

## Evidencias Esperadas

- Frontend `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.
- Backend typecheck/test/build passando quando backend for alterado.
- `npm audit --audit-level=high` sem vulnerabilidades altas antes de habilitar ambiente controlado.
- Logs sem API keys, tokens, Authorization headers, prompt bruto ou output bruto.
- Frontend sem secrets e sem chamada direta a OpenAI.
- Policy limpa/desabilitada quando rollback for necessario.
