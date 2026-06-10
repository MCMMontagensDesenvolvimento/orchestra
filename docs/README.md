# Orchestra Documentation

Esta pasta concentra a documentacao operacional atual e o arquivo historico do projeto Orchestra.

O frontend ja passou pela higienizacao tecnica inicial e ainda usa mocks controlados por `VITE_USE_MOCKS`. A fundacao real de backend, API, banco e infraestrutura local foi criada na Fase 04. A Fase 05 iniciou o core domain real e a integracao progressiva do frontend com a API. Runtime de IA, RAG, MCP, providers reais e SSO real continuam fora do escopo atual.

## Estrutura

```txt
docs/
|-- README.md
|-- decisions/
|-- product/
|-- engineering/
|-- architecture/
|-- backend/
|-- api/
|-- database/
|-- security/
|-- infrastructure/
|-- ai-orchestration/
`-- archive/
    `-- prototype/
```

## Ordem Recomendada De Leitura

1. `decisions/decision-log.md`
2. `architecture/ORCHESTRA_ARQUITETURA_DE_SOFTWARE.md`
3. `backend/ORCHESTRA_BACKEND_FOUNDATION.md`
4. `backend/ORCHESTRA_BACKEND_OPERATIONAL_VALIDATION.md`
5. `api/ORCHESTRA_API_FOUNDATION.md`
6. `backend/ORCHESTRA_CORE_DOMAIN_BACKEND.md`
7. `api/ORCHESTRA_CORE_DOMAIN_API.md`
8. `database/ORCHESTRA_DATABASE_FOUNDATION.md`
9. `database/ORCHESTRA_CORE_DOMAIN_DATABASE.md`
10. `engineering/ORCHESTRA_FRONTEND_API_INTEGRATION.md`
11. `infrastructure/ORCHESTRA_LOCAL_DEV_INFRASTRUCTURE.md`
12. `product/ORCHESTRA_CONTEXTO_INICIAL_DO_PROJETO.md`
13. `product/ORCHESTRA_BRIEF_MESTRE.md`
14. `product/ORCHESTRA_DISCOVERY_TECNICA_E_ESTRATEGICA.md`
15. `product/ORCHESTRA_REQUISITOS_DO_SISTEMA.md`
16. `product/ORCHESTRA_ESPECIFICACAO_FUNCIONAL.md`
17. `engineering/ORCHESTRA_FRONTEND.md`
18. `engineering/ORCHESTRA_INVENTARIO_ENTIDADES_FRONTEND.md`
19. `engineering/ORCHESTRA_HANDOFF_FRONTEND_LOVABLE.md`
20. READMEs de `security/` e `ai-orchestration/`.

## Status Dos Documentos

- `decisions/decision-log.md`: operacional, atualizado ate a Fase 05.
- `product/`: baseline operacional de produto para orientar arquitetura e backend.
- `engineering/`: estado tecnico atual do frontend e handoffs uteis.
- `architecture/`: arquitetura consolidada de software.
- `backend/`: fundacao backend real, core domain e validacao operacional local.
- `api/`: contratos HTTP implementados na fundacao e no core domain.
- `database/`: Prisma schema, migrations e seed.
- `infrastructure/`: Dockerfiles e Docker Compose local.
- `security/`: preparacao de hardening e Microsoft SSO.
- `ai-orchestration/`: area preparada para runtime, RAG, MCP e providers reais.
- `archive/prototype/`: registros historicos do prototipo, snapshots, roteiros antigos e documentos que nao devem orientar o desenvolvimento atual sem revisao.

## Proximos Documentos A Preencher

- Modelo final de autenticacao, autorizacao e auditoria.
- Estrategia de runtime, RAG, MCP e orquestracao de IA.
- Contratos OpenAPI quando a API estabilizar.
- Estrategia de deploy, backups, secrets e observabilidade de producao.
