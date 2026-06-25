# Orchestra - Fase 10D: Embeddings Backend-Only Fail-Closed

Status: implementado como base backend-only, sem geracao real de vetores e sem chamada externa.

## Objetivo

A Fase 10D prepara o backend para uma capacidade governada de embeddings sem ativar provider real. O sistema passa a ter contrato interno, readiness sanitizada e erro controlado para tentativas de gerar embeddings enquanto a capacidade estiver desabilitada ou sem provider valido.

## Decisoes

- Embeddings ficam desabilitados por padrao.
- O provider efetivo da fase e um provider `disabled`, sem rede externa.
- A readiness informa `enabled`, `configured`, `executionEnabled`, `provider`, `status`, `failClosed`, `model` e `dimension`.
- Tentativas internas de `embedText` ou `embedBatch` falham com erro de dominio e HTTP 409 quando propagadas pela API.
- Nenhum segredo, chave, token, prompt bruto, texto bruto ou output bruto e exposto.
- O RAG atual continua em `local_chunks_only`, com busca lexical/local keyword.
- A tabela `knowledge_chunk_embeddings` permanece apenas como estrutura preparada pela Fase 10C.

## Configuracao

As variaveis abaixo sao backend-only e seguras para `.env.example`:

```bash
EMBEDDINGS_ENABLED=false
EMBEDDINGS_PROVIDER=disabled
EMBEDDINGS_MODEL=
EMBEDDINGS_DIMENSION=
```

Mesmo que `EMBEDDINGS_ENABLED=true` seja usado com um provider planejado, a 10D continua fail-closed porque nenhum provider real foi configurado nesta fase.

## Readiness Esperada

Estado default:

```json
{
  "enabled": false,
  "configured": false,
  "executionEnabled": false,
  "provider": "disabled",
  "status": "disabled",
  "failClosed": true,
  "externalProviderCalled": false,
  "rawInputStored": false,
  "rawOutputStored": false
}
```

Quando um provider futuro for indicado por env, mas ainda sem implementacao real nesta fase, o status esperado e `misconfigured` e a tentativa de uso deve falhar com `EMBEDDING_PROVIDER_NOT_CONFIGURED`.

## Integracao com RAG

O endpoint de readiness de RAG passa a carregar uma subestrutura `embeddings`, mantendo os campos existentes:

- `retrievalMode: local_chunks_only`
- `embeddingsEnabled: false`
- `vectorStoreEnabled: false`

Nao ha alteracao na query RAG principal, no fallback lexical, em chunking, ingestion ou populacao da tabela de embeddings.

## Garantias de Seguranca

- Nao ha uso de SDK ou endpoint externo de embedding.
- Nao ha chamada direta a OpenAI, Azure OpenAI, Anthropic, Ollama, Hugging Face ou outro provider.
- Nao ha nova chave de API.
- Nao ha renderizacao ou persistencia de texto bruto para embedding.
- Frontend nao foi alterado e continua sem contato com provider de embedding.

## Validacao

Dentro de `backend`:

```bash
npm run typecheck
npm run lint
MICROSOFT_SSO_ENABLED=false \
MICROSOFT_CLIENT_ID= \
MICROSOFT_CLIENT_SECRET= \
MICROSOFT_TENANT_ID= \
MICROSOFT_REDIRECT_URI= \
MICROSOFT_POST_LOGOUT_REDIRECT_URI= \
MICROSOFT_ALLOWED_DOMAINS= \
MICROSOFT_ALLOWED_TENANT_IDS= \
npm run test -- --run
npm run build
npx prisma validate
npx prisma generate
```

Na raiz:

```bash
docker compose -f docker-compose.dev.yml exec -T backend npx prisma migrate status
git status --short
git diff --check
git diff --stat
```

## Proximo Passo

A Fase 10E deve definir a habilitacao governada de um provider real de embeddings, ainda com guardrails de ambiente, sem expor segredos, com testes de bloqueio por configuracao e sem alterar o frontend para chamar providers diretamente.
