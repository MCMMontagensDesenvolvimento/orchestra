# Orchestra LLM Provider Env Setup

Status: implementado na Fase 07C.

## Defaults Seguros

```env
LLM_PROVIDERS_ENABLED=false
LLM_DEFAULT_PROVIDER=local_deterministic
LLM_EXECUTION_ENABLED=false
LLM_PROVIDER_TIMEOUT_MS=30000
LLM_MAX_INPUT_PREVIEW_CHARS=500
LLM_MAX_OUTPUT_PREVIEW_CHARS=800
LLM_STORE_RAW_PROMPTS=false
LLM_STORE_RAW_OUTPUTS=false
```

Com esses defaults, o smoke local usa apenas provider local deterministico e nao depende de credenciais externas.

## OpenAI

```env
OPENAI_ENABLED=false
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_DEFAULT_MODEL=
OPENAI_EXECUTION_ENABLED=false
```

## Azure OpenAI

```env
AZURE_OPENAI_ENABLED=false
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=
AZURE_OPENAI_EXECUTION_ENABLED=false
```

## Anthropic

```env
ANTHROPIC_ENABLED=false
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_DEFAULT_MODEL=
ANTHROPIC_EXECUTION_ENABLED=false
```

## Operacao

- Nao colocar secrets no frontend.
- Nao versionar `.env` real.
- Nao habilitar provider externo sem fase dedicada de chamada HTTP, timeout, tratamento de erro e validacao manual.
- `scripts/smoke-local.sh` valida apenas provider local e bloqueio de provider externo.
