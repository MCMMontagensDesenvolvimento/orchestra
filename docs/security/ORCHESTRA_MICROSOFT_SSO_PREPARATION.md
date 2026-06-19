# Orchestra Microsoft SSO Preparation

Status: backend Microsoft SSO implementado na Fase 08B; frontend de login/logout
Microsoft conectado na Fase 08C; vinculo persistente de identidade externa e
auto-link governado implementados na Fase 08D.

## Visao Geral

O Microsoft Entra ID sera o provider corporativo de identidade do Orchestra. O
backend continua sendo a autoridade para sessao web, usuario interno, tenant,
workspaces, roles, permissions e auditoria.

A Fase 08A adicionou:

- schema de configuracao backend;
- defaults fail-closed;
- allowlists de dominio e tenant;
- contrato tipado de readiness;
- `GET /api/v1/auth/sso/config` sanitizado;
- redaction defensiva para nomes comuns de secrets, codes e tokens.

A Fase 08B adiciona start/callback real no backend, usando MSAL Node, e cria a sessao
Orchestra somente depois de todas as validacoes.

A Fase 08C conecta a tela de login ao readiness publico do backend, exibe o login
corporativo somente quando a configuracao permite, trata `sso_error` com mensagens
seguras e preserva logout via sessao Orchestra.

A Fase 08D adiciona a tabela `external_identities`, usa `oid` Microsoft como
identificador principal, permite fallback controlado para `sub` e remove a
dependencia de e-mail como identificador imutavel.

## Variaveis de Ambiente

```env
MICROSOFT_SSO_ENABLED=false
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/auth/microsoft/callback
MICROSOFT_ALLOWED_DOMAINS=
MICROSOFT_ALLOWED_TENANT_IDS=
MICROSOFT_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/login
MICROSOFT_SSO_AUTO_LINK_BY_EMAIL=false
```

Regras:

- `MICROSOFT_SSO_ENABLED` e `false` por padrao.
- Valores vazios sao tratados como ausentes.
- `MICROSOFT_ALLOWED_DOMAINS` e uma lista separada por virgula, normalizada para
  lowercase e sem duplicatas.
- `MICROSOFT_ALLOWED_TENANT_IDS` e opcional. Quando usada, deve incluir
  `MICROSOFT_TENANT_ID`.
- `configured=true` exige client ID, client secret, tenant ID, redirect URI, logout
  redirect URI e ao menos um dominio permitido.
- `enabled=true` nao torna o login obrigatorio e nao implica `configured=true`.
- `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL` e `false` por padrao. Quando `false`, apenas
  identidades externas previamente vinculadas podem concluir login.

Client secret e todas as credenciais ficam somente no backend ou secret manager.
Nao criar variaveis `VITE_*` para segredo, tenant privado, token ou authorization code.

## Configuracao Exposta ao Frontend

O endpoint publico pode retornar somente:

- provider;
- enabled;
- configured;
- dominios permitidos;
- rota interna reservada de login.

Client ID, tenant ID, tenant allowlist, client secret, redirect URI externa, tokens,
authorization code e headers nunca fazem parte da resposta.

O modo de auto-link por e-mail nao e exposto no endpoint publico. Ele e uma decisao
operacional backend-only.

O frontend 08C aceita `loginUrl` somente quando ele e exatamente
`/api/v1/auth/microsoft/start`. URLs absolutas, esquemas como `javascript:`/`data:`,
paths inesperados e valores vazios sao rejeitados no cliente.

## Azure App Registration

Checklist para cada ambiente:

1. Criar uma App Registration no Microsoft Entra ID.
2. Preferir account type single-tenant, "Accounts in this organizational directory
   only", para o fluxo corporativo inicial.
3. Adicionar plataforma `Web`.
4. Registrar a redirect URI exata do backend:
   - local: `http://localhost:3000/api/v1/auth/microsoft/callback`;
   - homologacao/producao: URL HTTPS do backend daquele ambiente.
5. Registrar a URI de retorno de logout aprovada para o ambiente.
6. Criar client secret em `Certificates & secrets`.
7. Copiar o valor do secret somente para o secret manager. Nao registrar o valor em
   repositorio, ticket, screenshot, log ou frontend.
8. Configurar somente scopes OIDC minimos:
   - `openid`;
   - `profile`;
   - `email`.
9. Nao solicitar Microsoft Graph nesta fase.
10. Registrar owner operacional, validade e rotina de rotacao do secret.

Cada ambiente deve usar App Registration e credenciais separadas.

## Fluxo Implementado na 08B

O fluxo:

- usar Authorization Code Flow;
- gerar e validar `state` contra CSRF;
- gerar e validar `nonce` para o ID token;
- usar PKCE, mesmo com client secret backend;
- aceitar callback somente na redirect URI registrada;
- validar issuer, audience, assinatura, expiracao, tenant e nonce;
- aplicar allowlist de tenant antes de mapear usuario;
- validar email normalizado contra a allowlist de dominios;
- falhar fechado quando a claim `email` estiver ausente; nao provisionar
  automaticamente a partir de claim alternativa sem regra aprovada;
- nunca logar query completa do callback ou payload bruto de token;
- descartar tokens Microsoft quando nao forem necessarios;
- emitir somente a sessao HttpOnly do Orchestra.

O Orchestra declara somente `openid`, `profile` e `email`. O MSAL Node adiciona seus
scopes OIDC padrao durante a montagem da requisicao. A instancia e o cache MSAL sao
locais a cada operacao; todas as contas do cache sao removidas apos a troca e nenhum
refresh token, access token ou ID token e persistido ou retornado pelo adapter.

## Cookie Transitorio

A transacao OAuth fica em cookie separado da sessao:

- nome derivado de `COOKIE_NAME`;
- HttpOnly;
- SameSite Lax;
- Secure conforme `COOKIE_SECURE`;
- path `/api/v1/auth/microsoft`;
- TTL de 10 minutos;
- conteudo JWT assinado com audience e issuer especificos.

O payload contem somente state, nonce e code verifier aleatorios. O code challenge
S256 e enviado a Microsoft. O cookie e limpo no inicio do callback, em sucesso ou
falha. Ele nao e gravado no banco.

## Claims Validadas

Depois da validacao criptografica feita pelo MSAL:

- issuer deve ser o endpoint v2 do tenant configurado;
- audience deve ser o client ID backend;
- tenant claim deve corresponder ao tenant configurado;
- tenant deve respeitar a allowlist opcional;
- expiracao deve estar no futuro;
- nonce deve corresponder a transacao;
- `email` deve existir e pertencer a dominio permitido;
- `preferred_username` pode substituir `email` apenas se tiver formato de e-mail e
  dominio permitido;
- `oid` e usado como subject externo principal;
- `sub` e usado somente como fallback quando `oid` estiver ausente;
- ausencia de `oid` e `sub` falha fechado com `external_subject_missing`;
- `name`, quando presente, pode ser armazenado apenas como `displayName` contextual.

## Mapeamento de Identidade

Estrategia atual da Fase 08D:

1. Validar issuer, audience, tenant, nonce, expiracao e e-mail.
2. Validar email corporativo e dominio permitido.
3. Extrair subject externo: `oid` preferencial, `sub` como fallback.
4. Procurar `external_identities` ativa por `provider`, `providerTenantId` e
   `providerUserId`.
5. Se o vinculo existir, carregar o usuario interno vinculado e seus dados de
   tenant, memberships, roles e permissions pelo banco Orchestra.
6. Se o vinculo nao existir e `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL=false`, falhar com
   `external_identity_not_linked`.
7. Se auto-link estiver habilitado, localizar exatamente um usuario interno
   existente por e-mail normalizado, ativo e nao deletado.
8. Bloquear conflitos quando o usuario ja tiver outra identidade Microsoft ativa.
9. Criar o vinculo externo e auditar `sso_identity_linked`.
10. Criar sessao Orchestra somente depois de todas as validacoes.

O e-mail e armazenado apenas como atributo contextual validado. Ele nao e mais o
identificador imutavel usado para resolver login quando existe vinculo persistente.

## Modelo Persistente 08D

Migration: `20260619120000_phase08d_external_identities`.

Tabela: `external_identities`.

Campos principais:

- `tenant_id`: tenant interno Orchestra;
- `user_id`: usuario interno Orchestra;
- `provider`: `microsoft`;
- `provider_tenant_id`: claim `tid`;
- `provider_user_id`: claim `oid` ou fallback `sub`;
- `issuer`: claim `iss` normalizada;
- `email`: e-mail corporativo validado e normalizado;
- `email_verified`: claim contextual, quando existir;
- `display_name`: claim `name` opcional;
- `last_login_at`, `linked_at`, `created_at`, `updated_at`, `deleted_at`.

Constraints e indices:

- FK para `tenants(id)` com cascade;
- FK para `users(id)` com cascade;
- indice por `tenant_id`;
- indice por `user_id`;
- indice por `email`;
- indice por `provider`, `provider_tenant_id`, `provider_user_id`;
- unique parcial em SQL para identidade ativa:
  `provider + provider_tenant_id + provider_user_id WHERE deleted_at IS NULL`.

Nao sao armazenados:

- `id_token`;
- `access_token`;
- `refresh_token`;
- authorization code;
- client secret;
- payload bruto de claims;
- resposta bruta Microsoft.

## Provisionamento Governado

Modo inicial seguro:

- `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL=false`;
- vinculos criados previamente por admin/seed/script controlado;
- login falha fechado quando a identidade externa ainda nao esta vinculada.

Modo assistido:

- `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL=true` temporariamente em ambiente controlado;
- auto-link apenas para usuario interno ja existente;
- nenhuma criacao de usuario, tenant, workspace ou role;
- conflito de identidade Microsoft ativa bloqueia o login;
- evento `sso_identity_linked` registra apenas metadados sanitizados.

Modo futuro:

- provisionamento via admin UI, SCIM ou fluxo aprovado;
- aprovacao administrativa;
- policies explicitas de dominio, tenant, workspace e roles.

## Frontend Implementado na 08C

A tela `/login`:

- consulta `GET /api/v1/auth/sso/config`;
- mantem o login atual/dev-login funcionando;
- mostra o botao "Entrar com Microsoft" com loading/disabled;
- habilita o botao somente com `enabled=true`, `configured=true` e `loginUrl`
  interno esperado;
- redireciona com `window.location.assign(loginUrl)` para o backend;
- nao monta authorization URL e nao chama Microsoft diretamente;
- nao usa `@azure/msal-browser`;
- nao grava token em `localStorage` ou `sessionStorage`;
- trata `sso_error` com mensagens seguras e remove o parametro da URL quando
  capturado.

Depois do callback bem-sucedido, o backend cria o cookie HttpOnly do Orchestra e
redireciona para `/app/dashboard`. O `ProtectedRoute` do frontend continua usando
`GET /api/v1/auth/me` como fonte de sessao, sem assumir token local.

Logout no frontend continua chamando `POST /api/v1/auth/logout`, limpando estado de
sessao local e voltando para `/login`. Logout federado Microsoft completo permanece
pendente para 08E ou fase posterior e nao deve ser iniciado diretamente pelo
browser.

## Auditoria e Logs

Eventos:

- `sso_login_started`;
- `sso_callback_received`;
- `sso_identity_linked`;
- `sso_login_succeeded`;
- `sso_login_failed`.

Metadata permitida:

- provider;
- etapa;
- reason code sanitizado;
- IDs internos somente quando o usuario interno ja foi resolvido;
- `externalIdentityId` interno, quando existir.

O callback e excluido do auto access-log porque sua query contem authorization code.
MSAL opera com logging PII desabilitado e callback de logger silencioso.

Nunca registrar:

- URL/query completa do callback;
- authorization code;
- client secret;
- ID token, access token ou refresh token;
- resposta bruta Microsoft;
- e-mail da identidade externa em audit de falha.
- `providerTenantId` e `providerUserId` brutos.

## Dev Login

O `POST /api/v1/auth/dev-login` continua funcionando em desenvolvimento/teste e
continua bloqueado em producao pelo backend. A Fase 08A nao altera esse comportamento.

Na Fase 08E:

- dev-login devera exigir ambiente de desenvolvimento explicitamente permitido;
- builds e deploys de producao deverao validar que ele permanece bloqueado;
- smoke de SSO e logout substituira o dev-login como caminho operacional.

## Proximas Fases

- 08E: bloqueio operacional do dev-login, logout federado/smoke real e checklist de
  producao.

## Checklist de Seguranca

- SSO desabilitado por padrao.
- Nenhuma credencial Microsoft necessaria para desenvolvimento local.
- Client secret somente no backend/secret manager.
- Nenhum token ou authorization code em resposta, log ou audit.
- Config publica coberta por teste de sanitizacao.
- Dominios normalizados e tenant allowlist validada.
- Start/callback implementados com rate limit e falha fechada.
- Callback nao registra query no access log.
- State, nonce e PKCE cobertos por testes sem chamada Microsoft real.
- Usuario deve existir e estar ativo; sem auto-provisionamento.
- Identidade externa persistente usa `oid` como subject principal e `sub` como
  fallback documentado.
- Auto-link por e-mail e opt-in, backend-only e nao cria usuario.
- Sessao final continua sendo o cookie HttpOnly do Orchestra.
- Frontend consome somente o backend, valida `loginUrl` interno e nao usa MSAL
  browser.
- Login atual/dev-login permanecem funcionando.
- `sso_error` e renderizado somente como mensagem segura, sem detalhes upstream.
- Sem Microsoft Graph ou persistencia de token/cache MSAL.
- Sem payload bruto de claims persistido.
- Rotacao e expiracao do client secret documentadas por ambiente.
