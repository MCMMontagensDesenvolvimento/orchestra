# Orquestra — Discovery Técnica e Estratégica

> Documento de descoberta técnica e estratégica do projeto Orquestra.  
> Preparado para uso interno na MCM.

---

## 1. Objetivo

Validar o problema, a proposta de solução, o valor esperado, a viabilidade técnica, os riscos, a direção de experiência e os principais encaminhamentos antes da definição detalhada de requisitos, fluxos, arquitetura e implementação.

Este documento consolida as hipóteses estratégicas, funcionais, técnicas e experienciais do Orquestra, reduzindo incertezas antes da construção do MVP.

---

## 2. Sumário executivo

O Orquestra é uma plataforma corporativa de assistentes de IA voltada à criação, configuração, publicação, execução, compartilhamento, auditoria e governança de assistentes inteligentes no contexto da MCM.

A descoberta confirma que a IA é o núcleo do produto, não um recurso periférico. O valor esperado depende da combinação entre assistentes configuráveis, LLMs reais, RAG, MCP/tools, runtime de agents, segurança, permissões, auditoria, cost tracking e versionamento.

O projeto parte de um protótipo visual de alta fidelidade criado no Lovable, ainda sem backend, banco de dados, autenticação real, runtime de IA, RAG real, MCP real, persistência ou auditoria operacional. Portanto, a principal decisão da descoberta é seguir com a evolução do protótipo para um MVP real, mantendo uma separação clara entre visão validada, hipóteses ainda abertas e implementação técnica futura.

Recomendação final:

```txt
Seguir com o projeto, mantendo ajuste controlado de escopo no documento de requisitos e aprofundamento técnico nos documentos de arquitetura, backend, frontend, banco, segurança, integrações e orquestração de IA.
```

---

## 3. Discovery Blueprint

```yaml
discovery_blueprint:
  project_name: "Orquestra"
  discovery_status: "síntese e decisão"
  source_mode: "protótipo Lovable existente"
  validated_problem: "A MCM precisa governar o uso corporativo de IA para evitar fragmentação, ausência de auditoria, exposição de dados, falta de controle de custos e iniciativas isoladas."
  validated_audience:
    - "Administrador da Plataforma"
    - "Criador/Owner de Assistente"
    - "Editor de Assistente"
    - "Usuário Consumidor do Chat"
    - "Áreas/departamentos da MCM"
    - "Times técnicos responsáveis por IA, segurança, backend, frontend e operação"
  validated_value: "Centralizar criação, execução e governança de assistentes de IA em uma plataforma corporativa, segura, auditável e preparada para expansão."
  recommended_solution: "Evoluir o protótipo para uma plataforma real com frontend, backend, banco, Microsoft SSO, RBAC, RAG real, MCP real, runtime Agno, OpenAI/Anthropic, auditoria, cost tracking e retenção de conversas."
  recommendation: "seguir com ajustes controlados"
  maturity_level: "Nível 4 — direção de solução, experiência e técnica definida"
  decisions_required:
    - "Corte detalhado entre MVP, versão 1, versão 2 e futuro."
    - "Escolha final da estratégia de vector store."
    - "Detalhamento do AgentSpec."
    - "Definição dos workspaces iniciais da MCM."
    - "Definição dos primeiros MCP servers/tools."
    - "Definição do ambiente de homologação e deploy."
```

---

## 4. Estado atual considerado

O projeto possui um protótipo visual de alta fidelidade construído no Lovable.

### 4.1 Achados principais

```txt
Frontend visual existente.
Dados mockados.
Autenticação simulada.
Backend ausente.
Banco de dados ausente.
APIs reais ausentes.
Runtime de IA ausente.
RAG real ausente.
MCP real ausente.
Auditoria real ausente.
Analytics real ausente.
Ambiente Docker/WSL ainda não estruturado.
Projeto ainda não exportado do Lovable.
```

### 4.2 Interpretação da descoberta

O protótipo confirma a direção visual e a visão de produto, mas não comprova operação real.

As telas existentes devem ser tratadas como:

- evidência de intenção de produto;
- base para validação de fluxos;
- referência visual inicial;
- fonte de inferência para requisitos;
- ponto de partida para higienização pós-exportação.

Elas não devem ser tratadas automaticamente como funcionalidades implementadas, regras de negócio finais, contratos técnicos, modelo de dados definitivo, arquitetura validada ou MVP funcional.

---

## 5. Problema validado

A MCM precisa estruturar e governar o uso corporativo de IA antes que assistentes, ferramentas e automações sejam adotados de forma descentralizada, sem segurança, sem auditoria, sem controle de dados e sem rastreabilidade de custos.

### 5.1 Dores associadas

- Uso potencialmente fragmentado de IA entre áreas.
- Falta de governança sobre prompts, bases, tools e modelos.
- Ausência de controle sobre dados sensíveis.
- Dificuldade de auditar interações, respostas e execuções.
- Risco de cada área criar soluções isoladas.
- Falta de cost tracking por assistente, área ou usuário.
- Risco de uso de tools externas sem aprovação.
- Falta de versionamento de assistentes e configurações.
- Falta de padrão para RAG, MCP, LLMs e runtime de agents.

### 5.2 Impacto de não agir

Se o projeto não avançar, a organização pode enfrentar crescimento desordenado do uso de IA, aumento de riscos de segurança e privacidade, dificuldade de mensurar custos, perda de rastreabilidade, baixa padronização de qualidade, dependência de soluções manuais ou isoladas e risco de shadow AI.

---

## 6. Públicos e contexto de uso

### 6.1 Administrador da Plataforma

Responsável pela governança global da plataforma.

Objetivos:

- gerenciar usuários;
- gerenciar permissões;
- aprovar publicações amplas;
- aprovar tools de alto risco;
- configurar providers e integrações;
- acompanhar auditoria;
- visualizar custos;
- gerenciar segurança e acesso.

### 6.2 Criador/Owner de Assistente

Responsável por criar e manter assistentes.

Objetivos:

- criar assistentes pelo wizard;
- configurar persona, objetivo, modelo, RAG, tools e regras;
- testar antes de publicar;
- publicar ou solicitar aprovação;
- acompanhar feedbacks, versões, custos e logs.

### 6.3 Editor de Assistente

Usuário autorizado a editar assistentes específicos.

Objetivos:

- ajustar configurações permitidas;
- testar alterações;
- colaborar com owners;
- respeitar recursos aos quais possui acesso;
- não visualizar dados ou conversas sem autorização.

### 6.4 Usuário Consumidor do Chat

Usuário que conversa com assistentes publicados e compartilhados.

Objetivos:

- encontrar assistentes disponíveis;
- conversar com segurança;
- ver fontes quando houver RAG;
- entender quando tools forem chamadas;
- enviar feedback.

---

## 7. Hipóteses de valor

| ID | Hipótese | Evidência atual | Status | Decisão |
|---|---|---|---|---|
| H_VAL_01 | Uma plataforma central reduz risco de uso desgovernado de IA. | Necessidade corporativa de governança e decisões já consolidadas. | Parcialmente validada | Seguir |
| H_VAL_02 | Áreas da MCM se beneficiarão de assistentes configuráveis. | Visão do produto e perfis definidos. | Parcialmente validada | Validar com workspaces iniciais |
| H_VAL_03 | RAG real aumenta valor ao conectar assistentes ao conhecimento corporativo. | RAG definido como parte do MVP alvo. | Validada conceitualmente | Seguir |
| H_VAL_04 | MCP/tools aumentam valor ao permitir ações e integrações. | MCP real e tools definidos como alvo. | Validada conceitualmente | Seguir com governança |
| H_VAL_05 | Auditoria e cost tracking são essenciais para adoção corporativa. | Riscos de custo, segurança e rastreabilidade. | Validada | Seguir |

---

## 8. Hipóteses de solução

| ID | Hipótese | Método de validação | Status | Decisão |
|---|---|---|---|---|
| H_SOL_01 | O protótipo atual é uma boa base visual para o MVP. | Revisão do estado atual e análise de telas. | Parcial | Seguir com higienização |
| H_SOL_02 | Wizard guiado é adequado para criação de assistentes. | Protótipo e visão de produto. | Parcial | Validar fluxo no documento funcional |
| H_SOL_03 | Separar Orquestra como control plane e Agno como runtime é abordagem adequada. | Decisão consolidada e aderência técnica ao problema. | Parcial | Aprofundar em arquitetura |
| H_SOL_04 | Compartilhamento flexível por usuário, workspace e tenant atende cenários corporativos. | Discussão de modelo e necessidade de expansão. | Validada conceitualmente | Seguir |
| H_SOL_05 | Uso e edição devem ser permissões separadas. | Diferença natural entre consumidor, editor e owner. | Validada | Seguir |

---

## 9. Hipóteses técnicas

| ID | Hipótese | Método de validação | Status | Encaminhamento |
|---|---|---|---|---|
| H_TEC_01 | Backend Node/TypeScript é adequado para a API principal. | Avaliação de stack e padrão web. | Parcial | Detalhar no documento de backend |
| H_TEC_02 | Runtime Agno em Python deve ser serviço separado. | Aderência ao ecossistema de IA e separação de responsabilidades. | Parcial | Detalhar em arquitetura e IA |
| H_TEC_03 | SSE é suficiente para chat com streaming no MVP. | Comparação com WebSocket e escopo MVP. | Validada para MVP | Seguir |
| H_TEC_04 | Fila será necessária para ingestão, embeddings, evals e jobs. | Natureza assíncrona dos processos. | Parcial | Detalhar em arquitetura |
| H_TEC_05 | PostgreSQL deve ser base transacional do MVP. | Necessidade de persistência, auditoria e relações. | Validada conceitualmente | Seguir |
| H_TEC_06 | Vector store precisa ser definida antes da arquitetura final. | RAG depende de embeddings e recuperação. | Pendente | Requer decisão |
| H_TEC_07 | Microsoft SSO via backend é necessário para segurança corporativa. | Decisão consolidada. | Validada | Seguir |
| H_TEC_08 | OpenAI e Anthropic são suficientes para MVP. | Decisão consolidada. | Validada | Seguir |

---

## 10. Hipóteses de experiência

| ID | Hipótese | Evidência | Status | Decisão |
|---|---|---|---|---|
| H_EXP_01 | Produto deve ser desktop-first. | Uso corporativo e painel administrativo. | Validada conceitualmente | Seguir |
| H_EXP_02 | Chat precisa mostrar estados de IA, fontes e tools. | RAG/MCP fazem parte do MVP. | Validada | Seguir |
| H_EXP_03 | Motion deve ser funcional e discreta. | Estados de IA, upload, indexação e streaming. | Validada conceitualmente | Seguir |
| H_EXP_04 | Usuário precisa entender limites do assistente. | Riscos de IA, RAG e tools. | Parcial | Detalhar no design e funcional |
| H_EXP_05 | Editor não deve visualizar automaticamente conversas de terceiros. | Risco de privacidade e permissão. | Validada | Seguir |

---

## 11. Hipóteses de IA

| ID | Hipótese | Evidência | Status | Decisão |
|---|---|---|---|---|
| H_IA_01 | IA é núcleo do Orquestra. | Produto é plataforma de assistentes. | Validada | Seguir |
| H_IA_02 | Agno deve ser runtime obrigatório do MVP. | Decisão consolidada. | Validada | Seguir |
| H_IA_03 | AgentSpec deve ser contrato intermediário entre Orquestra e runtime. | Necessidade de versionamento e controle. | Parcial | Detalhar tecnicamente |
| H_IA_04 | RAG real é essencial para valor corporativo. | Produto depende de bases de conhecimento. | Validada | Seguir |
| H_IA_05 | MCP/tools são essenciais para diferenciação. | MVP inclui MCP real. | Validada conceitualmente | Seguir com controle de risco |
| H_IA_06 | Evals iniciais são necessários para qualidade. | Necessidade de medir resposta. | Parcial | Definir escopo mínimo |
| H_IA_07 | Cost tracking é obrigatório para governança. | Custos variáveis de LLM. | Validada | Seguir |
| H_IA_08 | Redaction/PII avançado pode ficar para evolução futura. | MVP terá controles mínimos. | Parcial | Manter pendência controlada |

---

## 12. Direção da solução

Construir o Orquestra como uma plataforma web corporativa com:

- frontend React/Vite;
- backend Node/TypeScript;
- banco PostgreSQL;
- autenticação Microsoft SSO;
- RBAC;
- tenant e workspaces;
- assistentes versionados;
- compartilhamento flexível;
- Knowledge Hub;
- RAG real;
- MCP real;
- chat com LLM real;
- Agno runtime em Python;
- AgentSpec;
- auditoria;
- cost tracking;
- feedback;
- evals iniciais;
- observabilidade mínima;
- CI/CD mínimo.

### 12.1 Alternativas consideradas

| Alternativa | Prós | Contras | Decisão |
|---|---|---|---|
| Manter apenas protótipo Lovable | Rápido visualmente | Não entrega sistema real | Descartada |
| Construir IA direto no backend principal | Menos serviços | Acopla runtime de IA ao produto | Descartada como arquitetura alvo |
| Separar Orquestra e Agno | Melhor governança e separação de responsabilidades | Mais integração entre serviços | Aceita |
| Usar WebSocket no MVP | Mais flexível | Mais complexo que necessário | Fora do MVP |
| Usar apenas um provider LLM | Simples | Menor resiliência e flexibilidade | Descartada |
| OpenAI + Anthropic no MVP | Flexível e suficiente | Exige abstração de providers | Aceita |

---

## 13. Direção de MVP

### 13.1 Must have

- Microsoft SSO.
- RBAC inicial.
- Tenant e workspaces.
- CRUD de assistentes.
- Wizard completo.
- Versionamento.
- Publicação e aprovação.
- Compartilhamento.
- OpenAI e Anthropic.
- Chat com LLM real.
- RAG real.
- MCP real.
- Agno runtime.
- AgentSpec.
- Auditoria.
- Retenção de conversas.
- Feedback simples.
- Cost tracking inicial.
- Evals iniciais.
- Backend, banco e APIs reais.

### 13.2 Should have

- Analytics mínimo.
- Dashboard de uso.
- Logs de execução de tools.
- Histórico de versões amigável.
- Gestão básica de documentos.
- Gestão básica de MCP servers.
- Estados avançados de UI para IA.
- Observabilidade mínima.

### 13.3 Could have

- Templates de assistentes.
- Biblioteca de exemplos.
- Marketplace interno simples.
- Relatórios avançados.
- Mais providers.
- Permissões mais granulares por classificação.
- Redaction/PII mais sofisticado.

### 13.4 Not now

- WebSocket.
- Multi-agent avançado.
- Colaboração em tempo real.
- Versão mobile nativa.
- SEO/aquisição.
- Marketplace avançado.
- Providers adicionais obrigatórios.
- Multi-tenant complexo com regras avançadas.
- Redaction/PII completo.
- Integração ampla com todos os sistemas corporativos.

---

## 14. Discovery de experiência, design e frontend

### 14.1 Fluxos críticos

| Fluxo | Objetivo do usuário | Condição de sucesso | Risco |
|---|---|---|---|
| Login | Entrar com conta corporativa | Sessão criada com permissões corretas | Bloqueio por SSO mal configurado |
| Criar assistente | Configurar assistente pelo wizard | Assistente salvo como rascunho | Wizard longo/confuso |
| Testar assistente | Validar comportamento antes de publicar | Resposta real ou erro claro | Teste simulado parecer real |
| Publicar assistente | Tornar assistente disponível | Status e versão atualizados | Publicação sem aprovação |
| Compartilhar assistente | Liberar uso/edição | Acesso correto por usuário/workspace | Permissão excessiva |
| Usar chat | Obter resposta útil | Resposta com contexto, fontes e tool calls | Alucinação ou falta de confiança |
| Enviar feedback | Avaliar resposta | Feedback registrado | Feedback pouco usado |
| Consultar auditoria | Rastrear eventos | Logs encontrados | Falta de rastreabilidade |
| Gerenciar RAG | Subir e indexar documentos | Fontes recuperáveis | Dados sensíveis expostos |
| Gerenciar tools | Aprovar e vincular tools | Tool chamada com auditoria | Tool abuse |

### 14.2 Componentes esperados

- Layout autenticado.
- Sidebar/topbar.
- Cards de assistentes.
- Wizard multi-etapas.
- Formulários com validação.
- Tabelas com filtros.
- Empty states.
- Loading states.
- Error states.
- Permission gates.
- Chat message list.
- Chat composer.
- Source citations.
- Tool call indicators.
- Feedback controls.
- Version history.
- Audit log table.
- Cost summary cards.
- Upload de documentos.
- Status de indexação.

### 14.3 Estados obrigatórios de interface

- carregando;
- vazio;
- erro;
- sucesso;
- sem permissão;
- processando;
- resposta em streaming;
- tool em execução;
- fallback de modelo;
- RAG sem fonte;
- publicação pendente;
- aprovação concedida;
- aprovação rejeitada;
- documento indexando;
- documento com erro.

---

## 15. Discovery de motion e microinterações

Motion é recomendada como apoio funcional, não como elemento decorativo.

Contextos relevantes:

- chat respondendo;
- streaming;
- tool call em andamento;
- fallback de modelo;
- upload de documento;
- indexação de base;
- teste de assistente;
- publicação/aprovação;
- skeletons de dashboards;
- feedback de sucesso ou erro.

Riscos:

- excesso visual;
- distração;
- baixa acessibilidade;
- falta de suporte a redução de movimento;
- animações que escondem lentidão real;
- perda de clareza em estados críticos.

Decisão:

```txt
Seguir com motion funcional e discreta, aprofundando padrões em documento específico de design/interação quando chegar a etapa visual.
```

---

## 16. Discovery técnico

### 16.1 Arquitetura inicial

```txt
Frontend React/Vite
  ↓
Backend Orquestra Node/TypeScript
  ↓
PostgreSQL
  ↓
Agno Runtime Python
  ↓
LLM Providers / RAG / MCP / Tools
```

### 16.2 Implicações de backend

Módulos prováveis:

- auth;
- users;
- roles/permissions;
- tenants;
- workspaces;
- assistants;
- assistant versions;
- assistant shares;
- publishing approvals;
- knowledge bases;
- documents;
- ingestion jobs;
- mcp servers;
- tools;
- conversations;
- messages;
- feedback;
- audit logs;
- costs;
- evals;
- runtime orchestration.

### 16.3 Implicações de banco

Entidades prováveis:

- tenants;
- users;
- roles;
- permissions;
- workspaces;
- workspace_members;
- assistants;
- assistant_versions;
- assistant_shares;
- assistant_publication_requests;
- knowledge_bases;
- knowledge_base_documents;
- document_chunks;
- embeddings;
- mcp_servers;
- mcp_tools;
- assistant_tools;
- conversations;
- messages;
- feedbacks;
- audit_logs;
- provider_usage_costs;
- eval_datasets;
- eval_runs;
- runtime_deployments.

### 16.4 Implicações de infraestrutura

Necessidades previstas:

- frontend;
- backend;
- PostgreSQL;
- runtime Agno;
- possível Redis/fila;
- storage de documentos;
- Docker;
- compose dev/prod;
- healthchecks;
- logs;
- ambiente de homologação;
- controle de variáveis por camada;
- backup do banco;
- observabilidade mínima.

---

## 17. Discovery de integrações externas

| Integração | Obrigatória no MVP | Observação |
|---|---:|---|
| Microsoft SSO | Sim | Autenticação corporativa |
| OpenAI | Sim | Provider inicial |
| Anthropic | Sim | Provider inicial |
| Agno | Sim | Runtime de agents |
| MCP servers/tools | Sim | Escopo alvo do MVP |
| Vector store/embeddings | Sim | Necessário para RAG |
| Storage de documentos | Provável | Depende da estratégia de arquivos |
| Redis/fila | Provável | Jobs de ingestão, embeddings e evals |

Pontos a validar:

- credenciais;
- custos por uso;
- rate limits;
- fallback;
- sandbox;
- logs;
- segregação por tenant;
- retenção de dados;
- segurança de chamadas externas;
- monitoramento de falhas.

---

## 18. Discovery de IA orquestrada

IA é núcleo do produto.

O Orquestra não é apenas um sistema com uma chamada de LLM. Ele é uma plataforma de governança e execução de assistentes.

Capacidades esperadas:

- configuração de assistentes;
- agentes executáveis;
- RAG;
- MCP;
- tools;
- streaming;
- fontes/citações;
- fallback model;
- model routing;
- cost tracking;
- evals;
- AgentSpec;
- auditoria de execução;
- guardrails iniciais.

### 18.1 Riscos de IA

| Risco | Impacto | Mitigação |
|---|---|---|
| Alucinação | Alto | RAG, fontes, feedback e evals |
| Prompt injection | Crítico | Guardrails e validação de contexto |
| Vazamento via RAG | Crítico | Permissões por base |
| Tool abuse | Crítico | Aprovação admin e logs |
| Custo imprevisível | Alto | Cost tracking |
| Provider indisponível | Alto | Fallback model |
| Latência alta | Médio | Streaming e otimização |
| Baixa qualidade | Alto | Evals e feedback |
| AgentSpec inconsistente | Alto | Versionamento e validação |

Decisão:

```txt
Seguir com IA orquestrada como núcleo do projeto, aprofundando arquitetura, AgentSpec, RAG, MCP, evals, guardrails e observabilidade em documentação técnica específica.
```

---

## 19. Discovery operacional

O projeto ainda não foi exportado do Lovable nem clonado em ambiente Docker/WSL. Os documentos iniciais estão sendo organizados antes da estruturação técnica do repositório.

Implicações:

- não executar reorganização técnica antes da exportação;
- manter documentação organizada no Windows;
- preparar estrutura esperada de diretórios;
- após exportação, validar estrutura real do projeto;
- só depois aplicar ajustes de frontend, backend, Docker e ambientes.

Estratégia recomendada:

1. Concluir documentação inicial.
2. Exportar projeto do Lovable.
3. Criar repositório.
4. Organizar `/docs`.
5. Separar frontend.
6. Criar backend.
7. Configurar Docker e banco.
8. Validar ambiente local.
9. Evoluir para integração real.

---

## 20. Plano de validação

| Validação | Método | Evidência esperada | Decisão esperada |
|---|---|---|---|
| Valor da plataforma | Revisão com stakeholders | Confirmação de prioridade | Seguir |
| Perfis e permissões | Revisão de matriz | Perfis aprovados | Seguir/ajustar |
| Workspaces iniciais | Levantamento com MCM | Lista de áreas piloto | Definir piloto |
| Agno runtime | Spike/PoC técnica | Execução de AgentSpec | Seguir/ajustar |
| RAG | PoC com documentos | Resposta com fontes | Seguir/ajustar |
| MCP/tool calling | PoC de tool segura | Execução auditável | Seguir/ajustar |
| Microsoft SSO | Validação técnica | Login real | Seguir |
| Cost tracking | Simulação de uso | Métrica por assistente | Seguir |
| Evals | Definição de dataset inicial | Critérios de qualidade | Seguir/ajustar |
| UX do wizard | Revisão de fluxo | Redução de ambiguidades | Ajustar |
| Chat streaming | Protótipo técnico | Resposta progressiva | Seguir |

---

## 21. Matriz Hipótese → Evidência → Resultado → Decisão

| Hipótese | Tipo | Evidência | Confiabilidade | Resultado | Decisão | Encaminhamento |
|---|---|---|---|---|---|---|
| Plataforma central reduz risco de IA desgovernada | Valor | Contexto corporativo e decisões de governança | Alta | Validada | Seguir | Requisitos e governança |
| Protótipo é base visual útil | Solução | Protótipo Lovable e análise atual | Média | Parcial | Ajustar | Frontend e design |
| Backend real é obrigatório | Técnica | Ausência de backend atual | Alta | Validada | Seguir | Arquitetura/backend |
| Microsoft SSO é necessário | Técnica/segurança | Decisão consolidada | Alta | Validada | Seguir | Backend/segurança |
| Agno é runtime obrigatório | IA/técnica | Decisão consolidada | Alta | Validada | Seguir | Arquitetura/IA |
| RAG real é essencial | IA/valor | Escopo de Knowledge Hub | Alta | Validada | Seguir | IA/banco/segurança |
| MCP real é essencial | IA/integração | Escopo de MCP Hub | Alta | Validada | Seguir | IA/integrações |
| SSE é suficiente para MVP | Técnica/experiência | Necessidade de streaming textual | Média | Validada para MVP | Seguir | Arquitetura/frontend |
| WebSocket é necessário no MVP | Técnica | Escopo atual não exige bidirecionalidade complexa | Média | Refutada para MVP | Não incluir agora | Futuro |
| Redaction avançado é obrigatório no MVP | Segurança | MVP pode começar com controles mínimos | Média | Parcial | Deixar para evolução | Segurança |
| Cost tracking deve existir desde o MVP | Governança | Custo variável de providers | Alta | Validada | Seguir | Métricas/backend |
| Evals são necessários | Qualidade | Risco de baixa qualidade em IA | Média | Parcial | Definir mínimo | IA/qualidade |

---

## 22. Riscos principais

| Risco | Categoria | Probabilidade | Impacto | Mitigação |
|---|---|---:|---:|---|
| Escopo inflado | Produto | Alta | Alto | Fatiar MVP, versão 1, versão 2 e futuro |
| Valor não validado com áreas reais | Produto | Média | Alto | Definir áreas piloto |
| Integração Agno mais complexa que previsto | Técnico | Média | Alto | Spike técnico cedo |
| RAG exigir estratégia robusta de dados | Técnico | Alta | Alto | Definir vector store e permissões |
| MCP/tools abrirem risco operacional | Técnico/segurança | Média | Crítico | Aprovação admin e auditoria |
| Acesso indevido a RAG restrito | Segurança | Média | Crítico | Permissões por base e bloqueio indireto |
| Conversas exporem dados sensíveis | Segurança | Média | Alto | Controle de acesso e retenção |
| Alucinação | IA | Alta | Alto | RAG, fontes, evals e feedback |
| Prompt injection | IA/segurança | Média | Crítico | Guardrails e validação |
| Custo imprevisível | IA/financeiro | Média | Alto | Cost tracking |
| Falta de treinamento | Operação | Média | Médio | Documentação e governança |
| Ambiente indefinido | Operação | Média | Alto | Definir homologação cedo |

---

## 23. Decisão final do Discovery

### 23.1 Recomendação

```txt
Seguir com o projeto, ajustando e refinando o escopo no documento de requisitos.
```

### 23.2 Justificativa

- O problema é relevante para a MCM.
- O protótipo demonstra visão de produto.
- A solução tem valor estratégico claro.
- IA, RAG, MCP, Agno, auditoria e governança são coerentes com a proposta.
- As principais decisões de produto e tecnologia foram consolidadas.
- As pendências restantes são controladas e podem ser aprofundadas nas próximas etapas.

### 23.3 Condições para seguir

- Definir corte detalhado do MVP.
- Definir workspaces piloto.
- Detalhar arquitetura Agno/AgentSpec.
- Validar estratégia de RAG/vector store.
- Validar primeiros MCP servers/tools.
- Validar ambiente de autenticação Microsoft.
- Definir critérios mínimos de evals e cost tracking.

---

## 24. Encaminhamentos para os próximos documentos

### 24.1 Requisitos do Sistema

Encaminhar:

- perfis e permissões;
- tenant/workspace/owner/share;
- ciclo de vida dos assistentes;
- publicação/aprovação;
- Knowledge Hub;
- RAG;
- MCP/tools;
- chat;
- feedback;
- auditoria;
- retenção;
- cost tracking;
- evals;
- corte MVP, versão 1, versão 2 e futuro.

### 24.2 Especificação Funcional

Encaminhar fluxos:

- login;
- gestão de usuários;
- criação de assistente;
- edição de assistente;
- teste;
- publicação;
- aprovação;
- compartilhamento;
- chat;
- feedback;
- upload de documento;
- indexação;
- gestão de tools;
- auditoria;
- visualização de custos;
- histórico de versões.

### 24.3 Design e Frontend

Encaminhar:

- desktop-first;
- wizard multi-etapas;
- chat com streaming;
- fontes RAG;
- indicadores de tool call;
- estados de erro/carregamento;
- telas de permissão;
- dashboards;
- tabelas densas;
- formulários com validação;
- motion funcional;
- acessibilidade;
- responsividade mínima.

### 24.4 Arquitetura

Encaminhar:

- Orquestra como control plane;
- Agno como runtime;
- backend Node/TypeScript;
- runtime Python;
- PostgreSQL;
- possível Redis/fila;
- AgentSpec;
- REST para gestão;
- SSE para streaming;
- jobs assíncronos;
- integração com LLM providers;
- RAG;
- MCP;
- auditoria;
- segurança.

### 24.5 Backend, APIs e Banco

Encaminhar:

- módulos de domínio;
- contratos de API;
- entidades persistentes;
- logs de auditoria;
- conversas;
- feedbacks;
- costs;
- evals;
- runtime integration.

### 24.6 Segurança

Encaminhar:

- Microsoft SSO;
- RBAC;
- autorização por recurso;
- tenant isolation;
- workspace membership;
- RAG restrito;
- tools de alto risco;
- secrets;
- conversas;
- retenção por 360 dias;
- acesso a conversas;
- audit logs;
- prompt injection;
- tool abuse;
- dados sensíveis;
- redaction/PII futura.

### 24.7 Orquestração de IA

Encaminhar:

- Agno runtime;
- AgentSpec;
- LLM providers;
- model routing;
- fallback;
- RAG;
- embeddings;
- vector store;
- MCP;
- tools;
- guardrails;
- evals;
- cost tracking;
- observabilidade de IA;
- streaming;
- auditoria de execução.

### 24.8 Infraestrutura e Operação

Encaminhar:

- ambiente Windows atual;
- futura exportação do Lovable;
- futura organização em ambiente Docker/WSL;
- frontend;
- backend;
- PostgreSQL;
- runtime Agno;
- possível Redis/fila;
- storage de documentos;
- Docker Compose;
- `.env.example`;
- healthchecks;
- logs;
- backup;
- homologação;
- deploy futuro.

---

## 25. Maturidade do Discovery

Classificação:

```txt
Nível 4 — Direção de solução, experiência e técnica definida.
```

O projeto pode avançar para requisitos, especificação funcional e arquitetura, mantendo algumas decisões técnicas para aprofundamento.

Para atingir nível 5, é necessário:

- validar o corte do MVP;
- confirmar workspaces piloto;
- validar PoC inicial do Agno;
- definir vector store;
- confirmar ambiente de homologação;
- definir primeiros MCP servers/tools.

---

## 26. Próximos passos

1. Revisar este Discovery com stakeholders principais.
2. Atualizar o registro de decisões, se necessário.
3. Iniciar o documento de requisitos.
4. Iniciar o documento de especificação funcional em paralelo ou logo após requisitos.
5. Iniciar o documento de arquitetura de software.
6. Preparar aprofundamento específico de orquestração de IA.
7. Manter pendências de MVP, vector store, AgentSpec, workspaces e ambiente como decisões controladas.

---

## 27. Conclusão

A descoberta confirma que o Orquestra deve seguir para a próxima etapa.

O produto tem valor estratégico claro para a MCM, mas exige condução cuidadosa por envolver IA, RAG, MCP, runtime, dados sensíveis, auditoria, permissões, custos e governança.

A recomendação é seguir com a construção documental e técnica do MVP, sem tratar o protótipo atual como produto final e sem avançar para implementação antes de consolidar requisitos, fluxos, arquitetura e decisões técnicas críticas.
