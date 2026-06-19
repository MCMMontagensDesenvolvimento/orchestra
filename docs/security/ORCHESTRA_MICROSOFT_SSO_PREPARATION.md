# Orchestra Microsoft SSO Preparation

Status: fundacao segura implementada na Fase 08A; login Microsoft real ainda inativo.

## Visao Geral

O Microsoft Entra ID sera o provider corporativo de identidade do Orchestra. O
backend continua sendo a autoridade para sessao web, usuario interno, tenant,
workspaces, roles, permissions e auditoria.

A Fase 08A adiciona somente:

- schema de configuracao backend;
- defaults fail-closed;
- allowlists de dominio e tenant;
- contrato tipado de readiness;
- `GET /api/v1/auth/sso/config` sanitizado;
- redaction defensiva para nomes comuns de secrets, codes e tokens.

Ela nao inicia OAuth, nao processa callback, nao troca authorization code, nao cria
sessao Microsoft e nao modifica o frontend.

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

## Guardrails do Fluxo 08B

O fluxo futuro deve:

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

`offline_access` e refresh token nao fazem parte da fundacao 08A. Qualquer necessidade
futura deve passar por revisao de seguranca e retencao.

## Mapeamento de Identidade

Estrategia planejada:

1. Validar issuer/tenant e o identificador imutavel do usuario externo.
2. Validar email corporativo e dominio permitido.
3. Resolver uma vinculacao explicita entre identidade Microsoft e usuario interno.
4. Carregar tenant, memberships, roles e permissions somente do banco Orchestra.
5. Bloquear usuario interno ausente, inativo ou fora do tenant esperado.
6. Auditar sucesso/falha com IDs tecnicos e reason code sanitizado.

Email nao deve ser usado como unico identificador imutavel. A Fase 08D definira o
modelo persistente de identidade externa e a estrategia de provisionamento. Nenhuma
migration e criada em 08A.

## Dev Login

O `POST /api/v1/auth/dev-login` continua funcionando em desenvolvimento/teste e
continua bloqueado em producao pelo backend. A Fase 08A nao altera esse comportamento.

Na Fase 08E:

- dev-login devera exigir ambiente de desenvolvimento explicitamente permitido;
- builds e deploys de producao deverao validar que ele permanece bloqueado;
- smoke de SSO e logout substituira o dev-login como caminho operacional.

## Proximas Fases

- 08B: start/callback OIDC, state, nonce, PKCE, validacao e criacao de sessao.
- 08C: login/logout Microsoft no frontend e tratamento seguro de erros.
- 08D: mapeamento de identidade externa, tenant, workspace e RBAC.
- 08E: bloqueio operacional do dev-login, smoke real e checklist de producao.

## Checklist de Seguranca

- SSO desabilitado por padrao.
- Nenhuma credencial Microsoft necessaria para desenvolvimento local.
- Client secret somente no backend/secret manager.
- Nenhum token ou authorization code em resposta, log ou audit.
- Config publica coberta por teste de sanitizacao.
- Dominios normalizados e tenant allowlist validada.
- Callback e login Microsoft ainda nao implementados em 08A.
- Frontend e login atual permanecem inalterados.
- Sem Microsoft Graph, migration ou persistencia de token.
- Rotacao e expiracao do client secret documentadas por ambiente.
