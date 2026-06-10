# API

Status: operacional para a fundacao da Fase 04.

Esta pasta concentra contratos HTTP e convencoes de integracao do backend.

## Documentos

- `ORCHESTRA_API_FOUNDATION.md`: prefixos, envelopes de resposta, erros, autenticacao e endpoints implementados.

## Convencoes Atuais

- API de gestao em `/api/v1`.
- Healthchecks em `/health` e `/health/db`.
- REST + JSON.
- Cookie HttpOnly para sessao.
- Request id em header e corpo JSON.
- Erros estruturados com `status`, `code`, `message`, `fieldErrors` e `requestId`.
