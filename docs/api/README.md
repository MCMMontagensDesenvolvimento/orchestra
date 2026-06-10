# API

Status: operacional para a fundacao da Fase 04, contratos de core domain da Fase 05 e governanca de assistants das Fases 05B/05C.

Esta pasta concentra contratos HTTP e convencoes de integracao do backend.

## Documentos

- `ORCHESTRA_API_FOUNDATION.md`: prefixos, envelopes de resposta, erros, autenticacao e endpoints implementados.
- `ORCHESTRA_CORE_DOMAIN_API.md`: endpoints, paginacao, filtros e acoes de governanca de assistants.
- `ORCHESTRA_ASSISTANT_GOVERNANCE_API.md`: approval workflow, execution policy e execution precheck.

## Convencoes Atuais

- API de gestao em `/api/v1`.
- Healthchecks em `/health` e `/health/db`.
- REST + JSON.
- Cookie HttpOnly para sessao.
- Request id em header e corpo JSON.
- Erros estruturados com `status`, `code`, `message`, `fieldErrors` e `requestId`.
- Listagens paginadas com `data`, `pagination` e `requestId`.
- Acoes criticas usam `POST` dedicado, como `publish`, `unpublish`, `rollback`, `archive` e `restore`.
- Approval, execution policy e precheck ficam sob `/assistants/:id`.
