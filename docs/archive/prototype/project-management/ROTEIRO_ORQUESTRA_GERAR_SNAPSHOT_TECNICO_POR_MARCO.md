# PROMPT — Gerar Snapshot Técnico do Orquestra por Marco de Avanço

> Use este prompt sempre que o Orquestra atingir um novo marco de avanço: 25%, 50%, 75% ou 100% do MVP.  
> Substitua os campos `{{...}}` antes de enviar para Lovable, Codex, Claude, GPT ou outra IA/ferramenta de análise.

---

## Contexto

Você é um arquiteto de software sênior, especialista em auditoria técnica de projetos, frontend moderno, backend, APIs, banco de dados, segurança, IA, agents, RAG, MCP, DevOps, QA e documentação de sistemas reais.

Preciso que você gere uma nova documentação técnica do estado atual do projeto **Orquestra**, agora no marco:

```txt
{{M1_025 / M2_050 / M3_075 / M4_100_MVP}}
```

Esta documentação deve comparar o estado atual com:

```txt
1. O snapshot baseline M0 / 0%
2. O snapshot imediatamente anterior
3. Os critérios esperados para o marco atual
```

---

## Regra de confidencialidade e neutralidade

A documentação final deve ser neutra e institucional para uso interno da MCM.

Não mencione:

- YAZO;
- YAZO Labs;
- metodologia interna;
- nomes de SPRs;
- "SPR_00";
- "SPR_22";
- "SPR_23";
- qualquer referência à metodologia que orientou esta análise.

Você pode usar o método internamente para estruturar a análise, mas o documento final não deve expor esses termos.

Use termos neutros como:

```txt
documentação técnica
snapshot técnico
marco de avanço
camada técnica futura
orquestração de IA
motion e microinterações
integrações externas
backend
APIs
banco de dados
segurança
QA
infraestrutura
observabilidade
governança
```

---

## Entradas da análise

Considere como entrada:

```txt
1. Código atual do projeto Orquestra
2. Snapshot baseline M0:
   {{colar_ou_anexar_snapshot_M0}}
3. Snapshot anterior:
   {{colar_ou_anexar_snapshot_anterior}}
4. Plano de marcos e métricas:
   {{colar_ou_anexar_plano_de_marcos}}
5. Critérios do marco atual:
   {{colar_criterios_do_marco_atual}}
6. Decisões técnicas tomadas desde o último snapshot:
   {{colar_decisoes_relevantes}}
```

Se alguma entrada não estiver disponível, registre como `NAO_IDENTIFICADO` ou `PENDENTE`.

---

## Marco atual

Preencha:

```yaml
current_milestone:
  code: "{{M1 / M2 / M3 / M4}}"
  official_percentage: "{{25% / 50% / 75% / 100%}}"
  milestone_name: "{{Frontend Integration Ready / Backend API DB Core Ready / AI RAG MCP Core Ready / MVP Ready}}"
  analysis_date: "{{data}}"
  analyzed_source: "{{Lovable / GitHub / ZIP / Local / Outro}}"
  repository_or_source: "{{link ou referência}}"
```

---

## Critérios do marco atual

Use os critérios abaixo conforme o marco analisado.

### M1 — 25% — Frontend Integration Ready

Validar se foram concluídos:

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

### M2 — 50% — Backend/API/DB Core Ready

Validar se foram concluídos:

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
conversations/messages persistidos
audit logs reais para ações críticas
frontend consumindo APIs reais nos módulos principais
mocks removidos ou desativáveis nos fluxos core
Docker/compose local funcional
.env.example por camada
.gitignore/.dockerignore revisados
```

### M3 — 75% — AI/RAG/MCP Core Ready

Validar se foram concluídos:

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

### M4 — 100% — MVP Ready

Validar se foram concluídos:

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

---

## Taxonomia de status

Use:

```txt
IMPLEMENTADO
PARCIAL
MOCKADO
SIMULADO
HARDCODED
AUSENTE
PENDENTE
INFERIDO
RECOMENDADO
NAO_IDENTIFICADO
REQUER_DECISAO
```

---

## Scorecard de maturidade

Calcule a maturidade técnica usando:

| Dimensão | Peso | Nota 0–5 |
|---|---:|---:|
| Frontend, UX, Design System e higienização pós-Lovable | 20 | {{0-5}} |
| Backend, APIs e banco core | 25 | {{0-5}} |
| Autenticação, RBAC, segurança e multi-tenant | 15 | {{0-5}} |
| Orquestração de IA, RAG, MCP e chat real | 25 | {{0-5}} |
| QA, CI/CD, deploy, observabilidade e documentação | 15 | {{0-5}} |

Escala:

```txt
0 = ausente
1 = iniciado
2 = parcial
3 = funcional
4 = validado
5 = pronto para MVP
```

Fórmula:

```txt
maturidade_tecnica_percentual =
  Σ((nota_dimensão / 5) * peso_dimensão)
```

---

## O que a documentação final deve conter

Gere a documentação final em Markdown com a seguinte estrutura:

```markdown
# Orquestra — Snapshot Técnico do Estado Atual — {{Marco}}

## 0. Snapshot Blueprint
## 1. Leitura Executiva
## 2. Estado Atual do Projeto
## 3. Comparativo com o Marco Anterior
## 4. Comparativo com o Baseline M0
## 5. Scorecard de Maturidade Técnica
## 6. Critérios do Marco Atual
## 7. Critérios Atendidos
## 8. Critérios Pendentes
## 9. Evidências Técnicas
## 10. Evoluções desde o Marco Anterior
## 11. Regressões Identificadas
## 12. Novos Riscos
## 13. Frontend, UX e Design System
## 14. Backend, APIs e Banco
## 15. Autenticação, RBAC e Segurança
## 16. Orquestração de IA, RAG, MCP e Chat
## 17. QA, CI/CD, Deploy, Observabilidade e Documentação
## 18. Matriz Achado → Evidência → Impacto → Camada Técnica Futura
## 19. Decisões Pendentes
## 20. Prontidão para o Próximo Marco
## 21. Roadmap Atualizado
## 22. Resumo Executivo Final
```

---

## Snapshot Blueprint

Use este modelo:

```yaml
snapshot_blueprint:
  project_name: "Orquestra"
  milestone_code: "{{M1 / M2 / M3 / M4}}"
  official_percentage: "{{25% / 50% / 75% / 100%}}"
  milestone_name: "{{nome}}"
  analysis_date: "{{data}}"
  source_type: "{{Lovable / GitHub / ZIP / Local / Outro}}"

  frontend_status: ""
  backend_status: ""
  database_status: ""
  api_status: ""
  auth_status: ""
  rbac_status: ""
  ia_runtime_status: ""
  rag_status: ""
  mcp_status: ""
  security_status: ""
  qa_status: ""
  deploy_status: ""
  observability_status: ""
  documentation_status: ""

  current_maturity_level: ""
  calculated_technical_maturity: ""
  milestone_reached: "{{true/false/parcial}}"
  confidence: "{{Alta/Média/Baixa}}"

  main_evolutions_since_previous:
    - ""
  main_pending_items:
    - ""
  regressions:
    - ""
  critical_risks:
    - ""
  blocking_decisions:
    - ""
  recommendation:
    - ""
```

---

## Comparativo obrigatório

Gere uma tabela comparando:

```txt
Marco anterior vs Marco atual
M0 vs Marco atual
```

Use:

| Área | M0 | Marco anterior | Marco atual | Evolução | Regressão? | Evidência |
|---|---|---|---|---|---|---|

Áreas:

```txt
Frontend
Backend
Banco
APIs
Auth/RBAC
Segurança
IA/RAG/MCP
Integrações
QA
CI/CD
Deploy
Observabilidade
Documentação
Governança
```

---

## Matriz de achados

Gere:

| Achado | Evidência | Status | Confiança | Impacto | Severidade | Camada Técnica Futura | Ação recomendada | Owner sugerido |
|---|---|---|---|---|---|---|---|---|

---

## Regras finais

- Não invente funcionalidades.
- Não trate mock como implementação real.
- Não trate endpoint proposto como contrato final.
- Não trate schema inferido como banco final.
- Não trate chat visual como IA real.
- Não trate MCP visual como runtime real.
- Não trate RAG visual como busca semântica real.
- Quando algo for inferido, escreva: **inferido a partir da implementação atual**.
- Quando algo estiver pendente, marque como **PENDENTE** ou **REQUER_DECISAO**.
- Quando houver risco crítico, destaque no resumo executivo.
- Ao final, diga claramente se o marco foi atingido, parcialmente atingido ou não atingido.
