# Orchestra Documentation

Esta pasta concentra a documentacao operacional atual e o arquivo historico do projeto Orchestra.

O frontend ja passou pela higienizacao tecnica inicial e ainda usa mocks controlados por `VITE_USE_MOCKS`. A fundacao real de backend, API, banco e infraestrutura local foi criada na Fase 04. Runtime de IA, RAG, MCP, providers reais, SSO e integracao do frontend com a API real continuam fora do escopo atual.

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
6. `database/ORCHESTRA_DATABASE_FOUNDATION.md`
7. `infrastructure/ORCHESTRA_LOCAL_DEV_INFRASTRUCTURE.md`
8. `product/ORCHESTRA_CONTEXTO_INICIAL_DO_PROJETO.md`
9. `product/ORCHESTRA_BRIEF_MESTRE.md`
10. `product/ORCHESTRA_DISCOVERY_TECNICA_E_ESTRATEGICA.md`
11. `product/ORCHESTRA_REQUISITOS_DO_SISTEMA.md`
12. `product/ORCHESTRA_ESPECIFICACAO_FUNCIONAL.md`
13. `engineering/ORCHESTRA_FRONTEND.md`
14. `engineering/ORCHESTRA_INVENTARIO_ENTIDADES_FRONTEND.md`
15. `engineering/ORCHESTRA_HANDOFF_FRONTEND_LOVABLE.md`
16. READMEs de `security/` e `ai-orchestration/`.

## Status Dos Documentos

- `decisions/decision-log.md`: operacional, atualizado ate a Fase 04.
- `product/`: baseline operacional de produto para orientar arquitetura e backend.
- `engineering/`: estado tecnico atual do frontend e handoffs uteis.
- `architecture/`: arquitetura consolidada de software.
- `backend/`: fundacao backend real e validacao operacional local.
- `api/`: contratos HTTP implementados na fundacao.
- `database/`: Prisma schema, migracao e seed iniciais.
- `infrastructure/`: Dockerfiles e Docker Compose local.
- `security/`: area preparada para detalhamento de hardening e SSO.
- `ai-orchestration/`: area preparada para runtime, RAG, MCP e providers reais.
- `archive/prototype/`: registros historicos do prototipo, snapshots, roteiros antigos e documentos que nao devem orientar o desenvolvimento atual sem revisao.

## Proximos Documentos A Preencher

- Modelo final de autenticacao, autorizacao e auditoria.
- Estrategia de runtime, RAG, MCP e orquestracao de IA.
- Contratos OpenAPI quando a API estabilizar.
- Estrategia de deploy, backups, secrets e observabilidade de producao.
