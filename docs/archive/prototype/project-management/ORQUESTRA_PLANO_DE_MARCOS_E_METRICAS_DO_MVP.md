# ORQUESTRA — Plano de Marcos, Métricas e Snapshots do MVP

> **Documento interno — MCM**  
> **Projeto:** Orquestra  
> **Objetivo:** definir como medir avanço, maturidade técnica e marcos de entrega do MVP do Orquestra a partir de snapshots periódicos da documentação técnica do estado atual do projeto.  
> **Marco atual:** M0 — 0% oficial / baseline documental  
> **Data de referência:** {{preencher_data}}

---

## 1. Princípio central

O avanço do Orquestra será medido por duas leituras complementares:

```txt
1. Marco oficial de avanço: 0%, 25%, 50%, 75%, 100%
2. Maturidade técnica calculada: pontuação ponderada por camada
```

O marco oficial indica a etapa de maturidade do MVP.

A maturidade técnica calculada indica a evolução real do projeto em dimensões verificáveis, mesmo que o marco oficial ainda não tenha sido formalmente atingido.

### Regra

O marco percentual não deve ser definido por percepção subjetiva. Ele deve ser validado por evidência técnica, documentação atualizada, critérios de pronto e snapshot comparativo.

---

## 2. Baseline atual — Marco M0 / 0%

O Marco M0 representa a linha de base documental do Orquestra.

### Leitura atual

```yaml
milestone:
  code: "M0"
  official_percentage: "0%"
  name: "Baseline Lovable / Estado Atual Documentado"
  current_state: "Protótipo frontend de alta fidelidade"
  maturity_level: "Nível 2 — Frontend funcional mockado, com elementos do Nível 3"
  frontend: "Implementado visualmente, com dados mockados"
  backend: "Ausente"
  database: "Ausente"
  auth: "Simulada"
  ia_runtime: "Ausente"
  rag: "Ausente"
  mcp_runtime: "Ausente"
  api_layer: "Ausente"
  services_layer: "Ausente"
  production_readiness: "Bloqueada"
```

### Interpretação

O Orquestra possui um protótipo visual avançado, modular e bem estruturado, mas ainda não é um sistema real operável. O marco 0% representa o início da jornada de transformação do protótipo em MVP funcional.

---

## 3. Marcos oficiais do MVP

| Marco | Percentual oficial | Nome | Objetivo principal |
|---|---:|---|---|
| M0 | 0% | Baseline Lovable | Documentar o estado atual do protótipo. |
| M1 | 25% | Frontend Integration Ready | Consolidar frontend, isolar mocks e preparar integração real. |
| M2 | 50% | Backend/API/DB Core Ready | Criar backend, banco, autenticação, RBAC e APIs core. |
| M3 | 75% | AI/RAG/MCP Core Ready | Integrar IA real, RAG, MCP/tools e chat funcional. |
| M4 | 100% | MVP Ready | Entregar MVP operável, testado, documentado e homologável. |

---

## 4. M1 — 25% — Frontend Integration Ready

### Objetivo

Transformar o frontend Lovable em uma base técnica limpa, organizada e pronta para integração com backend real.

### Critérios obrigatórios

```txt
/frontend organizado ou decisão formal de estrutura
package manager padronizado
lockfile oficial definido
dependências Lovable residuais avaliadas/removidas quando aplicável
vite.config.ts revisado
rotas revisadas
páginas grandes quebradas em componentes
src/services criado
src/lib/api criado ou planejado com contrato estável
src/schemas criado para Zod
mocks isolados ou encapsulados por camada de service
TanStack Query utilizado em fluxos principais
React Hook Form + Zod utilizado em formulários principais
ProtectedRoute criado com sessão mockada ou adaptável para sessão real
ErrorBoundary global criado
loading/error/empty/success states padronizados
toasts unificados
responsividade crítica revisada
acessibilidade mínima revisada
motion/microinterações classificadas
```

### Estado esperado no snapshot M1

```yaml
expected_snapshot:
  frontend_status: "Alto / consolidado para integração"
  backend_status: "Ausente ou inicial"
  database_status: "Ausente"
  api_status: "Proposta futura ou adapters mockados"
  auth_status: "Mockada/Parcial, porém com arquitetura preparada"
  maturity_level: "Nível 3 — Frontend organizado e pronto para backend"
  backend_readiness: "Alta"
```

### Evidências esperadas

- estrutura reorganizada;
- commits ou arquivos criados;
- services/adapters;
- schemas;
- API client;
- rotas protegidas;
- refatoração de páginas grandes;
- documentação de mocks;
- checklist de higienização pós-Lovable.

---

## 5. M2 — 50% — Backend/API/DB Core Ready

### Objetivo

Criar a base real do sistema: backend, banco, autenticação, RBAC e APIs core.

### Critérios obrigatórios

```txt
/backend criado
PostgreSQL configurado
Prisma configurado
migrations iniciais
seeds a partir dos mocks relevantes
auth real implementada
sessão real integrada ao frontend
RBAC inicial implementado
tenant/workspace definido se aplicável
CRUD real de Assistants
CRUD real de Knowledge Bases
CRUD real de MCP Servers
conversations/messages persistidos, mesmo antes de IA avançada
audit logs reais para ações críticas
frontend consumindo APIs reais nos módulos principais
mocks removidos ou desativáveis nos fluxos core
Docker/compose local funcional
.env.example por camada
.gitignore/.dockerignore revisados
```

### Estado esperado no snapshot M2

```yaml
expected_snapshot:
  frontend_status: "Integrado parcialmente"
  backend_status: "Core implementado"
  database_status: "Core implementado"
  api_status: "Parcial/Existente"
  auth_status: "Real/Parcial"
  ia_runtime: "Ausente ou inicial"
  rag: "Ausente ou inicial"
  mcp_runtime: "Ausente ou inicial"
  maturity_level: "Nível 4 inicial — Frontend/backend/banco parcialmente integrados"
```

### Evidências esperadas

- pasta backend;
- migrations;
- seeds;
- endpoints core;
- autenticação funcional;
- RBAC;
- chamadas reais do frontend;
- logs de auditoria reais;
- documentação de API inicial.

---

## 6. M3 — 75% — AI/RAG/MCP Core Ready

### Objetivo

Ativar a proposta central do Orquestra com IA real, RAG funcional, MCP/tools e chat operacional.

### Critérios obrigatórios

```txt
runtime de IA definido
LLM provider integrado
chat com resposta real
streaming real ou tecnicamente validado
prompt compilado migrado para backend
versionamento de assistente/prompt funcionando
Knowledge Base com upload real
pipeline de ingestão inicial
embeddings gerados
vector store/pgvector funcionando
RAG retornando sources reais
MCP servers cadastrados com healthcheck real ou adapter real
tools executáveis ou simuladas por adapter real
logs de tool execution
guardrails iniciais
rate limit/quotas iniciais
cost tracking inicial
audit log real para ações de IA
frontend mostrando estados reais de IA
fallback de provider/modelo definido
```

### Estado esperado no snapshot M3

```yaml
expected_snapshot:
  frontend_status: "Alto"
  backend_status: "Alto para core"
  database_status: "Alto para core"
  api_status: "Alto para core"
  auth_status: "Real"
  ia_runtime: "Parcial/Implementado nos fluxos principais"
  rag: "Parcial/Implementado"
  mcp_runtime: "Parcial/Implementado"
  observability_status: "Parcial"
  qa_status: "Parcial"
  maturity_level: "Nível 4 sólido"
```

### Evidências esperadas

- chat real;
- streaming;
- provider LLM configurado;
- ingestão de documentos;
- embeddings;
- busca vetorial;
- sources/citações;
- tools ou adapters;
- logs de tool execution;
- métricas de tokens/custo/latência.

---

## 7. M4 — 100% — MVP Ready

### Objetivo

Entregar o MVP do Orquestra em estado operável, testado, documentado e homologável.

### Critérios obrigatórios

```txt
frontend consolidado
backend core completo
banco modelado e migrado
auth real
RBAC mínimo real
CRUDs principais reais
chat real com assistente
RAG funcional em escopo MVP
MCP/tools funcional em escopo MVP ou delimitado
audit log real
analytics mínimo real
segurança mínima aplicada
rate limit aplicado em IA
segredos protegidos
CI/CD mínimo
deploy em homologação ou produção controlada
testes mínimos
documentação técnica
runbook básico
decision log atualizado
snapshot final do MVP gerado
```

### Estado esperado no snapshot M4

```yaml
expected_snapshot:
  frontend_status: "Implementado"
  backend_status: "Implementado para MVP"
  database_status: "Implementado para MVP"
  api_status: "Implementado para MVP"
  auth_status: "Real"
  ia_runtime: "Implementado no escopo MVP"
  rag: "Implementado no escopo MVP"
  mcp_runtime: "Implementado no escopo MVP ou delimitado formalmente"
  security_status: "Mínimo aceitável"
  qa_status: "Mínimo aceitável"
  deploy_status: "Homologável/Produção inicial"
  maturity_level: "Nível 5 inicial — Sistema operável, auditado e pronto para evolução"
```

### Observação

100% representa a entrega do MVP, não o fim do produto. Evoluções, refinamentos, integrações avançadas e melhorias continuarão após o MVP.

---

## 8. Scorecard de maturidade técnica

A maturidade técnica será calculada por dimensão ponderada.

| Dimensão | Peso | Nota 0–5 | Fórmula |
|---|---:|---:|---|
| Frontend, UX, Design System e higienização pós-Lovable | 20 | {{0-5}} | nota/5 * 20 |
| Backend, APIs e banco core | 25 | {{0-5}} | nota/5 * 25 |
| Autenticação, RBAC, segurança e multi-tenant | 15 | {{0-5}} | nota/5 * 15 |
| Orquestração de IA, RAG, MCP e chat real | 25 | {{0-5}} | nota/5 * 25 |
| QA, CI/CD, deploy, observabilidade e documentação | 15 | {{0-5}} | nota/5 * 15 |
| **Total** | **100** |  | **soma ponderada** |

### Escala de nota

```txt
0 = ausente
1 = iniciado
2 = parcial
3 = funcional
4 = validado
5 = pronto para MVP
```

### Fórmula

```txt
maturidade_tecnica_percentual =
  Σ((nota_dimensão / 5) * peso_dimensão)
```

### Leitura

| Percentual calculado | Leitura |
|---:|---|
| 0–20% | Protótipo / base inicial |
| 21–40% | Fundação técnica em formação |
| 41–60% | Core do sistema em integração |
| 61–80% | Produto funcional em amadurecimento |
| 81–100% | MVP operável/homologável |

---

## 9. Scorecard inicial estimado — M0

> Este scorecard inicial é estimado com base na documentação do estado atual e deve ser revisado quando houver acesso ao repositório/código em cada marco.

| Dimensão | Nota estimada | Peso | Pontuação ponderada | Leitura |
|---|---:|---:|---:|---|
| Frontend, UX, Design System e higienização pós-Lovable | 2.5/5 | 20 | 10.0 | Protótipo forte, ainda mockado |
| Backend, APIs e banco core | 0/5 | 25 | 0.0 | Ausente |
| Autenticação, RBAC, segurança e multi-tenant | 0.5/5 | 15 | 1.5 | Visual/inferido |
| Orquestração de IA, RAG, MCP e chat real | 0.5/5 | 25 | 2.5 | Visual/inferido, sem runtime |
| QA, CI/CD, deploy, observabilidade e documentação | 0.5/5 | 15 | 1.5 | Configurações iniciais |
| **Total estimado** |  | **100** | **15.5%** | Maturidade técnica bruta inicial |

### Interpretação

```txt
Marco oficial: M0 / 0%
Maturidade técnica estimada: ~15.5%
```

O marco oficial permanece em 0% porque este é o baseline documental da jornada do MVP. A maturidade técnica bruta reconhece que já existe um protótipo frontend avançado.

---

## 10. Regra de aprovação de marco

Um marco só deve ser considerado atingido quando:

```txt
1. seus critérios obrigatórios estiverem atendidos;
2. houver evidências no código, tela, documentação ou ambiente;
3. os riscos críticos do marco anterior forem resolvidos ou formalmente aceitos;
4. o snapshot técnico do marco for gerado;
5. o comparativo com o marco anterior for produzido;
6. as decisões pendentes forem registradas.
```

### Regra de tolerância

Um marco pode ser aceito com pendências apenas se:

```txt
a pendência não bloquear o objetivo central do marco;
o impacto estiver documentado;
houver owner definido;
a pendência estiver registrada no roadmap;
a decisão estiver formalizada.
```

---

## 11. Snapshots oficiais

### Nomes recomendados

```txt
ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M0_000.md
ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M1_025.md
ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M2_050.md
ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M3_075.md
ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M4_100_MVP.md
```

### Estrutura esperada de cada snapshot

Cada snapshot deve conter:

```txt
1. State Audit Blueprint
2. Leitura executiva
3. Estado real atual
4. Comparativo com marco anterior
5. Comparativo com baseline M0
6. Scorecard de maturidade
7. Critérios do marco atual
8. Critérios atendidos
9. Critérios pendentes
10. Novos riscos
11. Regressões
12. Próximos passos
13. Matriz Achado → Evidência → Impacto → Camada Técnica Futura
14. Handoff para próximas etapas
```

---

## 12. Comparativo entre marcos

Cada novo snapshot deve comparar:

```txt
Marco atual vs marco anterior
Marco atual vs M0
```

### Template de comparação

| Área | Marco anterior | Marco atual | Evolução | Regressão? | Evidência |
|---|---|---|---|---|---|
| Frontend | | | | | |
| Backend | | | | | |
| Banco | | | | | |
| APIs | | | | | |
| Auth/RBAC | | | | | |
| IA/RAG/MCP | | | | | |
| Segurança | | | | | |
| QA | | | | | |
| Deploy/Operação | | | | | |
| Documentação | | | | | |

---

## 13. Como rodar nova documentação de estado atual em cada marco

Para cada marco futuro, usar:

```txt
1. Documentação técnica base mais atual
2. Snapshot anterior
3. Snapshot M0
4. Critérios do marco atual
5. Código/repositório atual
6. Decisões já tomadas
7. Roadmap vigente
```

### Exemplo M1 / 25%

```txt
Entradas:
- ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M0_000.md
- Critérios M1 deste documento
- código atual após consolidação frontend
- decisões técnicas tomadas desde M0

Saída:
- ORQUESTRA_SNAPSHOT_ESTADO_ATUAL_M1_025.md
```

---

## 14. Registro de decisões

Criar ou manter:

```txt
docs/decisions/decision-log.md
```

Decisões esperadas nos marcos:

| Marco | Decisões prováveis |
|---|---|
| M1 | Router, package manager, toast, dark mode, estrutura frontend/backend, motion. |
| M2 | Stack backend, banco, auth, RBAC, multi-tenant, Docker, API style. |
| M3 | Runtime IA, providers LLM, vector store, Agno/framework, MCP runtime, guardrails, evals. |
| M4 | Escopo final MVP, limites de uso, homologação, deploy, operação, runbook. |

---

## 15. Próxima ação recomendada

Após este documento, seguir o fluxo do manual atualizado para o Orquestra, começando pelos documentos/artefatos necessários ao modo "projeto já existente no Lovable", usando o snapshot M0 como base do estado atual.

O próximo passo prático é decidir se será executado:

```txt
1. revisão de contexto/brief/discovery do Orquestra;
2. consolidação técnica do frontend;
3. preenchimento dos documentos técnicos seguintes conforme o método vigente;
4. geração de prompts para implementação da Fase 1.
```

---

**Status:** baseline de métricas criado  
**Marco inicial:** M0 / 0% oficial  
**Maturidade técnica estimada inicial:** ~15.5%  
