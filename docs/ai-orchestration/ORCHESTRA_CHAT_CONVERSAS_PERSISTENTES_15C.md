# Orchestra Chat - Conversas Persistentes 15C

## Objetivo

A Fase 15C transforma o Chat em uma experiencia persistente: cada usuario autenticado pode criar, listar, abrir, continuar e arquivar conversas privadas por assistente, com mensagens salvas e resposta do assistente vinculada ao AgentRun criado pelo backend Orchestra.

## Modelagem

A modelagem evolui as tabelas existentes:

- `Conversation`: conversa persistente privada por usuario.
- `ConversationMessage`: mensagem persistente da conversa.

Campos adicionados em `Conversation`:

- `tenantId`
- `workspaceId`
- `ownerUserId`
- `visibility`
- `archivedAt`

Campos adicionados em `ConversationMessage`:

- `tenantId`
- `workspaceId`
- `assistantId`
- `agentRunId`

`visibility` nasce com espaco para `private`, `workspace`, `team` e `shared`; nesta fase o backend cria apenas `private`.

## Endpoints

Endpoints criados sob `/api/v1`:

- `GET /assistants/:id/conversations`
- `POST /assistants/:id/conversations`
- `GET /chat/conversations/:conversationId`
- `POST /chat/conversations/:conversationId/messages`
- `POST /chat/conversations/:conversationId/archive`

Os endpoints usam apenas o backend Orchestra. O frontend nao chama runtime externo, Agno, MCP, OpenAI, Azure OpenAI, Anthropic ou `/execute`.

## Fluxo De Envio

1. O frontend abre `/app/chat/:assistantId`.
2. O frontend lista conversas do assistente via backend.
3. O usuario cria ou seleciona uma conversa.
4. Ao enviar mensagem, o frontend chama `POST /api/v1/chat/conversations/:conversationId/messages`.
5. O backend valida tenant, workspace, owner e arquivamento.
6. O backend persiste `ConversationMessage` com `role = user`.
7. O backend cria `AgentRun` com:
   - `mode: "published"`
   - `source: "chat-conversation"`
   - metadata allowlisted com `origin`, `conversationId` e `assistantId`
   - `conversationId` interno vinculado ao run
8. O backend persiste `ConversationMessage` com `role = assistant`.
9. A mensagem do assistente recebe `agentRunId`.
10. O frontend renderiza mensagens persistidas e mantem detalhes tecnicos/eventos sob demanda do AgentRun.

O historico completo da conversa nao e enviado como contexto ao runtime nesta fase. Apenas a mensagem atual e usada como `input` do AgentRun.

## Isolamento

O MVP e privado por usuario:

- lista por `tenantId`, `workspaceId`, `assistantId` e `ownerUserId`;
- abre apenas conversa do proprio usuario;
- arquiva apenas conversa do proprio usuario;
- bloqueia mensagem nova quando `archivedAt` esta preenchido;
- nao implementa exclusao fisica.

Falhas de acesso retornam 404 para conversa inexistente ou fora do escopo do usuario, e 403 continua reservado para falha de permissao de rota.

## AgentRun

O AgentRun continua sendo criado pelo backend governado. A tela de Chat nao chama `/assistants/:id/runs` diretamente.

A resposta do assistente e uma mensagem persistida segura:

- para run `completed`, usa o `outputPreview` recebido internamente do runtime durante a criacao do AgentRun;
- para `blocked` e `failed`, usa texto controlado com codigo, mensagem e requestId quando aplicavel;
- nao persiste nem retorna `outputPreview` dentro do `metadata.runtime` publico do AgentRun;
- nao retorna payload bruto, headers, secrets, prompts internos, baseUrl, tokens ou metadata sensivel.

## Preparacao Para Compartilhamento Futuro

Nao ha compartilhamento real nesta fase.

A preparacao fica em:

- `visibility` na conversa;
- tenant/workspace em conversa e mensagem;
- owner explicito em `ownerUserId`;
- indices de escopo por tenant, workspace, assistant, owner e arquivamento.

Isso permite evoluir depois para compartilhamento governado por usuario, time ou workspace sem recriar a base.

## Frontend

Arquivos novos:

- `frontend/src/hooks/queries/useChatConversations.ts`

Arquivos evoluidos:

- `frontend/src/services/chat.service.ts`
- `frontend/src/hooks/queries/queryKeys.ts`
- `frontend/src/pages/Chat/ChatPage.tsx`
- `frontend/src/types/index.ts`
- `frontend/src/services/api/endpoints.ts`

O ChatPage agora usa:

- painel lateral de conversas;
- criacao de nova conversa;
- abertura de conversa existente por `conversationId` na querystring;
- renderizacao de mensagens persistidas;
- envio por endpoint de conversa;
- arquivamento logico;
- detalhes tecnicos e eventos sob demanda do AgentRun vinculado.

## Fora De Escopo

- Streaming.
- Compartilhamento real.
- Geracao de titulo por IA.
- Exclusao fisica.
- Envio do historico da conversa como contexto do runtime.
- Alteracao de runtime provider.
- Alteracao de auth, SSO ou RBAC fora do uso do usuario autenticado.

## Validacoes

Validacoes executadas durante a implementacao:

- `npm --prefix backend run typecheck`
- `npm --prefix frontend run typecheck`
- `npm --prefix backend run lint`
- `npm --prefix frontend run lint`
- `npm --prefix backend run build`
- `npm --prefix frontend run build`
- `cd backend && npx prisma validate --schema prisma/schema.prisma`
- `cd backend && npx prisma generate --schema prisma/schema.prisma`
- `npm --prefix backend run test -- tests/api/chat-conversations.test.ts tests/api/agent-runs.test.ts`
- `npm --prefix frontend run test -- src/test/real-mode-pages.test.tsx src/test/real-api-services.test.ts`
- `npm --prefix frontend run test`
- `git diff --check`

`npm --prefix backend run test` foi executado e terminou com 5 arquivos falhando / 26 testes falhando fora do escopo desta fase:

- `tests/api/auth.test.ts`: ambiente local com Microsoft SSO habilitado, enquanto os testes esperam SSO desabilitado.
- `tests/api/runtime.test.ts` e `tests/runtime/runtime-agno-http-adapter.test.ts`: ambiente local com `RUNTIME_PROVIDER=agno_http`, enquanto os testes esperam provider default `local`.
- `tests/unit/mcp-remote-discovery.test.ts` e `tests/unit/mcp-remote-readiness.test.ts`: erro de carregamento dotenv/Prisma (`Cannot read properties of undefined (reading 'match')`).

As validacoes focadas de conversas persistentes e AgentRun passaram apos o ajuste de seguranca que impede `outputPreview` no metadata publico do run.
