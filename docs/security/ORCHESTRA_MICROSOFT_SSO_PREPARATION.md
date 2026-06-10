# Orchestra Microsoft SSO Preparation

Status: preparado e documentado para fase posterior.

Esta fase nao implementa Microsoft SSO real. O objetivo e registrar a configuracao esperada e reservar variaveis backend-only sem quebrar o dev-login local.

## App Registration Esperado

- Aplicacao web no Microsoft Entra ID.
- Redirect URI local: `http://localhost:3000/api/v1/auth/microsoft/callback`.
- Redirect URI futura de producao: definida pelo dominio final do backend.
- Client ID armazenado como variavel de ambiente.
- Tenant ID armazenado como variavel de ambiente.
- Client secret armazenado somente no backend ou secret manager.

## Variaveis Backend-Only

```env
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/auth/microsoft/callback
MICROSOFT_ALLOWED_DOMAINS=
MICROSOFT_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/login
```

O client secret nunca deve ser exposto ao frontend.

## Endpoints Futuros Reservados

```txt
GET /api/v1/auth/microsoft/start
GET /api/v1/auth/microsoft/callback
POST /api/v1/auth/logout
```

## Sessao

O fluxo futuro deve manter:

- callback processado no backend;
- cookie HttpOnly para sessao web;
- `GET /api/v1/auth/me` como bootstrap do frontend;
- logout server-side;
- auditoria de login e logout;
- restricao de dominio quando `MICROSOFT_ALLOWED_DOMAINS` estiver configurado.

## Scopes Minimos

- `openid`
- `profile`
- `email`

Scopes adicionais devem ser justificados por necessidade de produto.

## Limites Desta Fase

- Sem callback OIDC real.
- Sem troca real de code por token.
- Sem validacao real de assinatura de token Microsoft.
- Sem provisionamento SCIM.
- Sem MFA gerenciado pelo Orchestra.

O dev-login permanece restrito a ambiente nao produtivo e continua sendo o caminho local de desenvolvimento.
