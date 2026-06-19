# Orchestra Auth API

Status: Microsoft SSO backend start/callback e sessao implementados na Fase 08B;
frontend conectado na Fase 08C; identidade externa persistente e auto-link governado
implementados na Fase 08D.

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

## Consumo Frontend do SSO

A tela `/login` do frontend consome `GET /api/v1/auth/sso/config` para descobrir
readiness. O botao "Entrar com Microsoft" fica ativo somente quando:

- `enabled=true`;
- `configured=true`;
- `loginUrl` e exatamente `/api/v1/auth/microsoft/start`.

O frontend redireciona apenas para essa rota interna do backend. Ele nao monta URL
Microsoft, nao usa MSAL browser, nao armazena tokens e nao conhece client ID, tenant
ID ou secrets.

Quando o callback falha, a tela de login aceita somente o codigo sanitizado em
`sso_error`, mapeia para mensagem amigavel e nao ecoa detalhes desconhecidos.

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
5. extrai subject externo com `oid` preferencial e `sub` como fallback;
6. resolve identidade persistente em `external_identities`;
7. quando nao ha vinculo, falha fechado ou faz auto-link por e-mail somente se
   `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL=true`;
8. resolve somente usuario interno existente, ativo e associado a tenant ativo;
9. atualiza `lastLoginAt` do usuario e do vinculo externo;
10. cria o JWT/cookie HttpOnly de sessao Orchestra;
11. redireciona para `FRONTEND_ORIGIN/app/dashboard`.

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
- `external_subject_missing`;
- `external_identity_not_linked`;
- `external_identity_conflict`;
- `external_identity_link_failed`;
- `user_not_found`;
- `user_inactive`;
- `tenant_inactive`;
- `workspace_unavailable`;
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
- dominio presente em `MICROSOFT_ALLOWED_DOMAINS`;
- `oid` usado como identificador externo principal;
- `sub` usado apenas como fallback quando `oid` nao existe;
- `name` opcional para display contextual.

A validacao criptografica da resposta OIDC e realizada pelo MSAL Node. O Orchestra
reaplica as validacoes de governanca acima antes de resolver o usuario.

## Mapeamento de Identidade e Usuario

O backend procura primeiro um vinculo ativo em `external_identities` por:

- `provider=microsoft`;
- claim `tid` como `providerTenantId`;
- claim `oid` ou fallback `sub` como `providerUserId`.

Se o vinculo existir, o usuario interno vinculado continua sendo a autoridade para
tenant, workspaces, roles e permissions.

Se o vinculo nao existir, o comportamento default e falhar com
`external_identity_not_linked`. Com `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL=true`, o backend
pode criar vinculo somente para usuario interno ja existente por e-mail validado,
ativo e sem conflito de identidade Microsoft. Nao ha criacao automatica de usuario,
tenant, workspace ou role.

A tabela `external_identities` nao armazena tokens, authorization code, client secret
ou claims brutas.

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
O frontend continua usando este endpoint para logout do Orchestra e redireciona para
`/login`. Logout federado Microsoft completo nao deve ser chamado diretamente pelo
frontend; a integracao federada fica para fase posterior.
