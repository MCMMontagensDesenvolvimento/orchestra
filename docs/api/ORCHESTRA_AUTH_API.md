# Orchestra Auth API

Status: Microsoft SSO backend start/callback e sessao implementados na Fase 08B.

Base path: `/api/v1/auth`.

## Configuracao Publica de SSO

```http
GET /api/v1/auth/sso/config
```

Endpoint publico, sanitizado e protegido pelo rate limit das rotas de autenticacao.
Ele existe para o frontend descobrir readiness sem receber credenciais Microsoft.

Resposta:

```json
{
  "data": {
    "provider": "microsoft",
    "enabled": false,
    "configured": false,
    "allowedDomains": [],
    "loginUrl": "/api/v1/auth/microsoft/start"
  },
  "requestId": "req_..."
}
```

Campos:

- `provider`: provider de identidade planejado.
- `enabled`: valor de `MICROSOFT_SSO_ENABLED`.
- `configured`: `true` somente quando todas as configuracoes backend obrigatorias
  estao presentes, existe ao menos um dominio permitido e o tenant principal respeita
  a allowlist opcional.
- `allowedDomains`: lista normalizada e sem duplicatas.
- `loginUrl`: rota backend que inicia o Authorization Code Flow.

A resposta nunca inclui:

- client ID;
- tenant ID ou allowlist de tenant IDs;
- client secret;
- redirect URIs externas;
- authorization code;
- ID token, access token ou refresh token;
- headers de autorizacao.

## Iniciar Microsoft SSO

```http
GET /api/v1/auth/microsoft/start
```

Endpoint publico com rate limit de autenticacao.

Quando SSO esta habilitado e configurado:

1. gera `state`, `nonce` e PKCE `code_verifier`;
2. deriva `code_challenge` com S256;
3. grava a transacao em cookie HttpOnly assinado, SameSite Lax, TTL de 10 minutos e
   path restrito a `/api/v1/auth/microsoft`;
4. solicita ao MSAL Node a URL de autorizacao;
5. retorna `302` para Microsoft Entra ID.

Scopes declarados pelo Orchestra:

- `openid`;
- `profile`;
- `email`.

O adapter usa `ConfidentialClientApplication`. Client ID, tenant, client secret,
verifier e nonce nao sao retornados em JSON.

Erros JSON antes de qualquer redirect:

- `409 SSO_DISABLED`;
- `503 SSO_MISCONFIGURED`;
- `502 SSO_PROVIDER_UNAVAILABLE`.

## Callback Microsoft

```http
GET /api/v1/auth/microsoft/callback
```

O callback:

1. limpa imediatamente o cookie transitorio;
2. valida assinatura/expiracao da transacao e compara `state` em tempo constante;
3. troca o authorization code no backend com o mesmo redirect URI e code verifier;
4. passa state/nonce ao MSAL e valida novamente claims essenciais;
5. resolve somente usuario interno existente e ativo;
6. atualiza `lastLoginAt`;
7. cria o JWT/cookie HttpOnly de sessao Orchestra;
8. redireciona para `FRONTEND_ORIGIN/app/dashboard`.

O callback nao tem auto access-log para impedir que a query com authorization code
seja registrada. Auditoria propria registra apenas provider, etapa, reason code e,
em sucesso, IDs internos.

Falhas retornam `302` para:

```txt
FRONTEND_ORIGIN/login?sso_error=<codigo_sanitizado>
```

Codigos possiveis:

- `sso_disabled`;
- `sso_misconfigured`;
- `state_invalid`;
- `callback_invalid`;
- `provider_error`;
- `token_exchange_failed`;
- `claims_invalid`;
- `nonce_invalid`;
- `tenant_invalid`;
- `domain_invalid`;
- `email_missing`;
- `user_not_found`;
- `user_inactive`;
- `internal_error`.

Nenhuma mensagem upstream, e-mail, tenant, query, code ou token e adicionada ao
redirect.

## Claims Validadas

- issuer exato do tenant Microsoft v2;
- audience igual ao client ID;
- `tid` igual ao tenant principal e presente na allowlist opcional;
- `exp` ainda valido;
- nonce igual ao valor da transacao;
- `email` normalizado, com fallback documentado para `preferred_username` quando
  ele tem formato de e-mail;
- dominio presente em `MICROSOFT_ALLOWED_DOMAINS`.

A validacao criptografica da resposta OIDC e realizada pelo MSAL Node. O Orchestra
reaplica as validacoes de governanca acima antes de resolver o usuario.

## Mapeamento de Usuario

O backend busca e-mail case-insensitive em usuario nao deletado. Usuario ausente ou
com status diferente de `active` falha fechado. Nao existe auto-provisionamento.

Vinculo persistente por `oid`/`sub` nao faz parte da Fase 08B e sera tratado na 08D.

## Login de Desenvolvimento

```http
POST /api/v1/auth/dev-login
```

Permanece disponivel somente fora de producao. A Fase 08A nao altera seu payload,
cookie, resposta ou auditoria.

## Sessao Atual

```http
GET /api/v1/auth/me
```

Exige cookie de sessao valido e continua retornando usuario, tenant, workspaces,
roles e permissions.

## Logout Atual

```http
POST /api/v1/auth/logout
```

Exige sessao, registra audit de logout, limpa o cookie HttpOnly e retorna `204`.
Logout federado Microsoft sera integrado em fase posterior.
