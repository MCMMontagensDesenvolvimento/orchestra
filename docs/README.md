# Orchestra Documentation

Esta pasta concentra a documentacao operacional atual e o arquivo historico do projeto Orchestra.

O frontend ja passou pela higienizacao tecnica inicial e preserva mocks controlados por `VITE_USE_MOCKS`. A fundacao real de backend, API, banco e infraestrutura local foi criada na Fase 04. A Fase 05 iniciou o core domain real e a integracao progressiva do frontend com a API. A Fase 05B consolidou governanca inicial de assistants com publicacao versionada, rollback, feedback e test results manuais/simulados. A Fase 05C adicionou approval workflow, execution policy, sandbox policy e precheck sem runtime real. A Fase 05D containerizou o frontend e validou o stack local `frontend` + `backend` + `db` em modo API real. A Fase 05E adicionou AgentRun, eventos persistidos, runtime boundary fake, cancelamento e contratos observaveis. A Fase 05F reduziu debt tecnico do frontend, removeu o alerta de bundle acima de 500 kB e documentou hygiene de dependencias. A Fase 06 adicionou catalogo governado de Knowledge/RAG/MCP, ingestion placeholder, bindings com assistants e frontend em API mode. A Fase 06B adicionou ingestao local controlada, chunking textual, source references, jobs com eventos e readiness de RAG local. Runtime real de IA, RAG semantico, MCP, providers reais, embeddings, vector store e SSO real continuam fora do escopo atual.

## Estrutura

```txt
docs/
|-- README.md
|-- decisions/
|-- product/
|-- engineering/
|-- frontend/
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
8. `backend/ORCHESTRA_PHASE_05B_ASSISTANT_GOVERNANCE_HANDOFF.md`
9. `backend/ORCHESTRA_PHASE_05C_APPROVAL_EXECUTION_GOVERNANCE.md`
10. `api/ORCHESTRA_ASSISTANT_GOVERNANCE_API.md`
11. `security/ORCHESTRA_ASSISTANT_EXECUTION_GOVERNANCE.md`
12. `backend/ORCHESTRA_AGENT_RUN_GOVERNANCE.md`
13. `api/ORCHESTRA_RUNTIME_EXECUTION_CONTRACTS.md`
14. `database/ORCHESTRA_RUNTIME_EXECUTION_MODEL.md`
15. `security/ORCHESTRA_EXECUTION_GOVERNANCE_SECURITY.md`
16. `backend/ORCHESTRA_KNOWLEDGE_MCP_CATALOG.md`
17. `api/ORCHESTRA_KNOWLEDGE_MCP_CATALOG_API.md`
18. `database/ORCHESTRA_KNOWLEDGE_MCP_CATALOG_MODEL.md`
19. `security/ORCHESTRA_KNOWLEDGE_MCP_CATALOG_SECURITY.md`
20. `frontend/ORCHESTRA_PHASE_06_KNOWLEDGE_MCP_FRONTEND.md`
21. `backend/ORCHESTRA_KNOWLEDGE_INGESTION_PIPELINE.md`
22. `backend/ORCHESTRA_KNOWLEDGE_CHUNKING_LOCAL.md`
23. `api/ORCHESTRA_RAG_READINESS_API_CONTRACTS.md`
24. `database/ORCHESTRA_KNOWLEDGE_CHUNKS_DATA_MODEL.md`
25. `security/ORCHESTRA_KNOWLEDGE_CONTENT_SECURITY.md`
26. `ai-orchestration/ORCHESTRA_RAG_READINESS_HANDOFF.md`
27. `database/ORCHESTRA_DATABASE_FOUNDATION.md`
28. `database/ORCHESTRA_CORE_DOMAIN_DATABASE.md`
29. `engineering/ORCHESTRA_FRONTEND_API_INTEGRATION.md`
30. `frontend/ORCHESTRA_FRONTEND_TECHNICAL_DEBT_AND_BUNDLE_HEALTH.md`
31. `frontend/ORCHESTRA_FRONTEND_DEPENDENCY_HYGIENE.md`
32. `infrastructure/ORCHESTRA_LOCAL_DEV_INFRASTRUCTURE.md`
33. `infrastructure/ORCHESTRA_FULLSTACK_LOCAL_DEVELOPMENT.md`
34. `product/ORCHESTRA_CONTEXTO_INICIAL_DO_PROJETO.md`
35. `product/ORCHESTRA_BRIEF_MESTRE.md`
36. `product/ORCHESTRA_DISCOVERY_TECNICA_E_ESTRATEGICA.md`
37. `product/ORCHESTRA_REQUISITOS_DO_SISTEMA.md`
38. `product/ORCHESTRA_ESPECIFICACAO_FUNCIONAL.md`
39. `engineering/ORCHESTRA_FRONTEND.md`
40. `engineering/ORCHESTRA_INVENTARIO_ENTIDADES_FRONTEND.md`
41. `engineering/ORCHESTRA_HANDOFF_FRONTEND_LOVABLE.md`
42. READMEs de `security/` e `ai-orchestration/`.

## Status Dos Documentos

- `decisions/decision-log.md`: operacional, atualizado ate a Fase 06B.
- `product/`: baseline operacional de produto para orientar arquitetura e backend.
- `engineering/`: estado tecnico historico do frontend e handoffs uteis.
- `frontend/`: debt tecnico, bundle health, hygiene de dependencias e integracao Knowledge/MCP da Fase 06.
- `architecture/`: arquitetura consolidada de software.
- `backend/`: fundacao backend real, core domain, governanca de assistants, approval/execution governance, AgentRun, catalogo Knowledge/MCP, ingestao local/chunking e validacao operacional local.
- `api/`: contratos HTTP implementados na fundacao, no core domain, nas acoes de governanca de assistants, em AgentRun, no catalogo Knowledge/MCP e em RAG readiness local.
- `database/`: Prisma schema, migrations, seed, modelo de runtime execution, modelo Knowledge/MCP e modelo de chunks/source references.
- `infrastructure/`: Dockerfiles, Docker Compose local e guia fullstack local.
- `security/`: preparacao de hardening, Microsoft SSO e governanca de execucao de assistants/agent runs.
- `ai-orchestration/`: area preparada para runtime, RAG, MCP e providers reais.
- `archive/prototype/`: registros historicos do prototipo, snapshots, roteiros antigos e documentos que nao devem orientar o desenvolvimento atual sem revisao.

## Proximos Documentos A Preencher

- Modelo final de autenticacao, autorizacao e auditoria.
- Estrategia de runtime, RAG, MCP e orquestracao de IA.
- Contratos OpenAPI quando a API estabilizar.
- Estrategia de deploy, backups, secrets e observabilidade de producao.
