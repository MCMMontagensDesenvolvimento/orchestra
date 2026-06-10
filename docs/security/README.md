# Security

Status: preparado para seguranca, SSO e refinamento inicial de RBAC/ABAC.

Esta pasta deve concentrar seguranca, compliance, autenticacao, autorizacao e auditoria.

Topicos esperados:

- Modelo de identidade.
- Sessoes.
- Permissoes.
- Segredos e configuracao.
- Auditoria.
- Politicas de dados.

## Documentos

- `ORCHESTRA_MICROSOFT_SSO_PREPARATION.md`: preparacao de Microsoft SSO para fase posterior, sem implementacao real nesta fase.

## Estado Atual

- Dev-login permanece restrito a ambiente nao produtivo.
- Sessao web usa cookie HttpOnly.
- Backend aplica permissoes por rota e policies por acao de assistant.
- Bloqueios de permissao registram `permission_denied` em audit log.
- SSO corporativo real segue reservado para fase posterior.
