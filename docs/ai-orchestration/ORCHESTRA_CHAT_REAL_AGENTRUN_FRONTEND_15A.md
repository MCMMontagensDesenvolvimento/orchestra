# Orchestra Chat Real via AgentRun Frontend 15A

## Resumo

A Fase 15A substitui o placeholder de chat em modo real por uma experiencia minima usando o contrato existente de `AgentRun`.

O frontend continua chamando somente o backend Orchestra:

```txt
POST /api/v1/assistants/:id/runs
```

Nao ha chamada direta do frontend para runtime Agno, OpenAI, Azure, Anthropic, MCP, tools ou qualquer provider externo.

## Fluxo implementado

1. `/app/chat` lista assistentes publicados.
2. `/app/chat/:assistantId` carrega o assistente pelo backend.
3. A tela consulta a publicacao ativa do assistente.
4. O envio cria um `AgentRun` com:

```json
{
  "mode": "published",
  "input": "mensagem do usuario",
  "source": "frontend-chat",
  "metadata": {
    "origin": "chat-ui",
    "assistantId": "...",
    "route": "/app/chat/:assistantId"
  }
}
```

## Estados cobertos

- carregando assistente;
- assistente nao encontrado;
- usuario sem acesso;
- falha ao consultar publicacao ativa;
- assistente ainda nao publicado;
- assistente publicado sem publicacao ativa;
- envio em andamento;
- `completed`;
- `blocked`;
- `failed`;
- erro de API no envio.

## Resposta textual

O contrato publico atual de `AgentRun` nao garante texto top-level da resposta. A UI procura campos textuais seguros conhecidos, priorizando `metadata.runtime.outputPreview` quando disponivel.

Quando nao ha campo textual claro em uma execucao `completed`, a tela mostra fallback com `runId` e `requestId`.

## Detalhes tecnicos expandidos

Cada resposta de assistente associada a um run exibe detalhes tecnicos em area expansivel:

- status;
- runId;
- traceId;
- requestId;
- runtime provider, quando presente em metadata segura.

## Fora de escopo

- streaming;
- historico conversacional persistente;
- chamada direta a Agno ou `/execute`;
- variaveis `AGNO_*` no frontend;
- alteracao de schema Prisma, migrations ou seed;
- alteracao de auth, SSO ou RBAC;
- mudanca de contrato backend.

## Testes adicionados/ajustados

- A pagina de chat em modo real deixa de renderizar o placeholder de prototipo.
- O envio de mensagem usa o hook de `AgentRun` com `mode: "published"` e `source: "frontend-chat"`.
- O service de runs chama `endpoints.assistants.runs(assistantId)` em modo real.

## Validacao recomendada

```bash
git diff --check
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test
grep -RInE "AGNO_RUNTIME_HTTP|127.0.0.1:8091|localhost:8091|/execute|agno_http|Agno" frontend/src || true
```

`agno_http` pode aparecer apenas como valor renderizado a partir de metadata segura retornada pelo backend.
