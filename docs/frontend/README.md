# Orchestra Frontend Docs

Status: operacional para saude tecnica do frontend ate a Fase 05F e integracao Knowledge/MCP da Fase 06.

Esta pasta registra diagnosticos, decisoes e pendencias especificas do frontend React/Vite. Ela complementa `docs/engineering/` e deve ser lida quando a mudanca envolver bundle, dependencias, lint, build, mocks/API mode ou containerizacao do frontend.

## Documentos

- `ORCHESTRA_FRONTEND_TECHNICAL_DEBT_AND_BUNDLE_HEALTH.md`: diagnostico de debt tecnico, bundle, lint, Fast Refresh, hooks e validacoes da Fase 05F.
- `ORCHESTRA_FRONTEND_DEPENDENCY_HYGIENE.md`: estado de `npm audit`, `npm outdated`, decisao sobre Vite/esbuild e plano seguro de upgrades.
- `ORCHESTRA_PHASE_06_KNOWLEDGE_MCP_FRONTEND.md`: services, hooks e telas integradas ao catalogo Knowledge/MCP em API mode.

## Regras De Escopo

- O frontend preserva `VITE_USE_MOCKS=true` para mocks e `VITE_USE_MOCKS=false` para API real.
- O frontend nao deve conter secrets, providers reais, runtime de IA, RAG real, MCP real ou SSO real.
- Rotas autenticadas continuam sob `/app/*`, com redirects legados mantidos ate uma revisao especifica.
- Alteracoes de performance devem ser medidas por `npm run build`, nao assumidas.
