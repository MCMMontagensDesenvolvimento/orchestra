# Orchestra Auth API

Status: fundacao Microsoft SSO implementada na Fase 08A.

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
- `loginUrl`: rota interna reservada para o inicio do fluxo na Fase 08B.

Nesta fase, `loginUrl` e somente um contrato de integracao. A rota
`GET /api/v1/auth/microsoft/start` ainda nao foi implementada e o frontend nao deve
navegar para ela.

A resposta nunca inclui:

- client ID;
- tenant ID ou allowlist de tenant IDs;
- client secret;
- redirect URIs externas;
- authorization code;
- ID token, access token ou refresh token;
- headers de autorizacao.

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

## Rotas Reservadas

As rotas abaixo ainda nao estao implementadas:

```txt
GET /api/v1/auth/microsoft/start
GET /api/v1/auth/microsoft/callback
```

O callback, troca de code, validacao OIDC, state, nonce e PKCE pertencem a Fase 08B.
