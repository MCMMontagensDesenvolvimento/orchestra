# Decision Log — Orquestra

> Documento de decisões técnicas e de produto do projeto Orquestra.  
> Caminho futuro recomendado no repositório: `orquestra/docs/decisions/decision-log.md`.

---

## Status possíveis

```txt
decidida
pendente
assumida_temporariamente
revisada
substituída
```

---

## DEC-001 — Autenticação via Microsoft SSO

```yaml
decision:
  id: "DEC-001"
  topic: "Autenticação oficial dos usuários"
  status: "decidida"
  decision: "O Orquestra utilizará login via Microsoft SSO / Microsoft Entra ID."
  reason: "O sistema será usado em contexto corporativo interno, onde a autenticação via identidade Microsoft centraliza acesso, reduz necessidade de senhas próprias e facilita governança."
  implementation_direction:
    frontend:
      - "Preparar tela de login com ação Entrar com Microsoft."
      - "Implementar AuthProvider/AuthContext."
      - "Implementar ProtectedRoute."
      - "Implementar RoleGuard/PermissionGate quando o modelo de permissões for definido."
      - "Consultar sessão atual via endpoint backend, como GET /api/v1/auth/me."
      - "Tratar estados de autenticação: carregando, autenticado, não autenticado, sem permissão e erro."
    backend:
      - "Implementar fluxo Microsoft SSO na camada backend."
      - "Utilizar @azure/msal-node na camada backend."
      - "Criar endpoints de início de login, callback, sessão atual e logout."
      - "Validar identidade Microsoft no backend antes de criar sessão da aplicação."
      - "Gerar sessão segura da aplicação após autenticação bem-sucedida."
  impacted_areas:
    - "Frontend"
    - "Backend"
    - "Segurança"
    - "Permissões"
    - "Auditoria"
    - "Governança"
  impacted_artifacts:
    - "LoginPage"
    - "AuthProvider"
    - "ProtectedRoute"
    - "RoleGuard"
    - "API de autenticação"
    - "Modelo de usuário"
    - "Decision Log"
  owner: "Time técnico MCM"
  required_before:
    - "Implementação de backend real"
    - "Proteção real de rotas"
    - "RBAC real"
  date: "2026-06-04"
```

---

## DEC-002 — Backend como autoridade de sessão e permissões

```yaml
decision:
  id: "DEC-002"
  topic: "Autoridade de autenticação, sessão e autorização"
  status: "decidida"
  decision: "O backend será a autoridade final para autenticação, sessão e permissões. O frontend apenas refletirá o estado autorizado retornado pela API."
  reason: "Permissões apenas no frontend não são suficientes para segurança. O backend deve validar identidade, roles/permissões e acesso aos recursos."
  implications:
    - "Rotas protegidas no frontend são camada de UX, não camada de segurança final."
    - "Endpoints devem validar usuário autenticado e autorização."
    - "A UI deve ocultar/desabilitar ações sem permissão, mas o backend deve bloquear chamadas indevidas."
    - "A definição final de roles e permissões ainda depende de decisão de produto/governança."
  impacted_areas:
    - "Frontend"
    - "Backend"
    - "APIs"
    - "Segurança"
    - "Auditoria"
  owner: "Time técnico MCM"
  required_before:
    - "MVP com usuários reais"
    - "Publicação de assistentes"
    - "Compartilhamento de assistentes"
    - "Execução de ferramentas/MCP"
  date: "2026-06-04"
```

---

## DEC-003 — Orquestra como control plane e runtime de IA como camada especializada

```yaml
decision:
  id: "DEC-003"
  topic: "Separação entre plataforma Orquestra e runtime de agentes/IA"
  status: "decidida"
  decision: "O Orquestra será a camada de gestão, governança e configuração dos assistentes. A execução real dos agentes/IA será tratada por uma camada runtime especializada."
  reason: "Separar produto/plataforma de runtime reduz acoplamento e permite avaliar frameworks, providers e estratégias de execução sem transformar o Orquestra em uma dependência rígida de um único motor."
  implications:
    - "O Orquestra deve armazenar configuração, versão, status, permissões e governança dos assistentes."
    - "A execução de agentes, tools, memória, RAG e chamadas a modelos deve ficar em camada especializada."
    - "Deve existir um contrato intermediário de configuração do agente, como um AgentSpec ou estrutura equivalente."
    - "A integração com runtime de IA será aprofundada em etapa própria."
  impacted_areas:
    - "Arquitetura"
    - "Backend"
    - "Orquestração de IA"
    - "Integrações"
    - "Segurança"
    - "Observabilidade"
    - "Métricas"
  owner: "Time técnico MCM"
  required_before:
    - "Integração real com LLM"
    - "RAG real"
    - "MCP/tools reais"
    - "Chat real com streaming"
  date: "2026-06-04"
```

---

## DEC-004 — Agno como candidato preferencial para PoC de runtime de agentes

```yaml
decision:
  id: "DEC-004"
  topic: "Avaliação de framework para runtime de agentes"
  status: "assumida_temporariamente"
  decision: "Agno será considerado candidato preferencial para PoC de runtime/orquestração de agentes, mas ainda não está aprovado como dependência final do MVP."
  reason: "O framework parece aderente ao conceito de agentes, tools, workflows, memória, runtime e governança de IA, mas precisa ser validado tecnicamente em uma PoC antes de decisão definitiva."
  current_position:
    - "Agno não deve ser integrado nesta fase inicial de consolidação do frontend."
    - "Agno deve ser considerado na fase de orquestração de IA."
    - "A decisão final dependerá de PoC técnica, segurança, deploy, observabilidade, integração com backend e aderência ao modelo de produto."
  validation_required:
    - "Criar agente simples em Agno."
    - "Expor execução via API/runtime."
    - "Testar chamada do backend do Orquestra para o runtime."
    - "Testar sessão/conversa."
    - "Testar uma tool simples."
    - "Testar integração com base de conhecimento simples."
    - "Avaliar logs, traces, custo e segurança."
  impacted_areas:
    - "Backend"
    - "Orquestração de IA"
    - "Integrações externas"
    - "Observabilidade"
    - "Segurança"
    - "Métricas"
  owner: "Time técnico MCM"
  review_condition: "Revisar antes de iniciar implementação real de runtime de agentes, RAG, MCP e chat com IA."
  date: "2026-06-04"
```

---

## DEC-005 — Marco 0% do MVP

```yaml
decision:
  id: "DEC-005"
  topic: "Marco inicial de acompanhamento do MVP"
  status: "decidida"
  decision: "A documentação técnica do estado atual gerada a partir do protótipo Lovable será considerada o Marco 0% oficial do MVP do Orquestra."
  reason: "O projeto já possui protótipo visual de alta fidelidade, mas ainda não possui backend, banco, autenticação real, runtime de IA, RAG real ou MCP real. Portanto, o marco 0% representa o início da jornada de transformação em MVP real, não ausência total de trabalho."
  baseline_summary:
    - "Frontend de alta fidelidade existente."
    - "Dados mockados."
    - "Backend ausente."
    - "Banco ausente."
    - "Autenticação simulada."
    - "Runtime de IA ausente."
    - "RAG real ausente."
    - "MCP real ausente."
  next_milestones:
    - "25% — Frontend consolidado e pronto para integração real."
    - "50% — Backend, APIs, banco e autenticação core funcionando."
    - "75% — IA/RAG/MCP reais integrados aos fluxos principais."
    - "100% — MVP entregue, testado, documentado e homologável."
  owner: "Time técnico MCM"
  date: "2026-06-04"
```

---

# Decisões ainda pendentes

As decisões abaixo ainda não foram fechadas e devem ser validadas com o idealizador/produto antes da especificação funcional e técnica final:

```txt
PEND-001 — Perfis, papéis e permissões do Orquestra.
PEND-002 — Modelo de compartilhamento de assistentes/agentes.
PEND-003 — Modelo tenant/workspace/team para o MVP.
PEND-004 — Escopo mínimo da criação/publicação de assistentes no MVP.
PEND-005 — Fluxo de aprovação para publicação de assistentes e uso de tools de risco.
PEND-006 — Quais áreas/departamentos da MCM serão contemplados no MVP.
PEND-007 — Quais LLM providers serão permitidos inicialmente.
PEND-008 — Qual será o nível de auditoria exigido no MVP.
PEND-009 — Qual será o escopo real do MCP no MVP.
PEND-010 — Qual será o escopo real do RAG no MVP.
PEND-011 — Política de retenção de conversas, prompts, respostas e logs.
PEND-012 — Estratégia de aprovação/homologação de assistentes antes da publicação.
```

---

# Histórico de alterações

| Data | Alteração | Autor |
|---|---|---|
| 2026-06-04 | Criação inicial do Decision Log com decisões já firmadas e pendências iniciais. | Time técnico MCM |
