# Fase 18C — Correção do Wizard de Assistants

Data: 28 de julho de 2026  
Branch: `fase-18c-correcao-wizard-assistants`  
Base: `ca7e3db`  
Escopo: frontend funcional, testes offline e documentação  
Status: implementado, pendente de homologação visual manual

## 1. Objetivo

Corrigir os bugs centrais encontrados na homologação 18B sem alterar o schema
Prisma, criar migration, executar provider externo, MCP real, embeddings,
Chat/AgentRun ou deploy.

A fonte canônica dos campos editáveis das 12 etapas passa a ser
`assistant_versions.configuration`. O `instructions` continua existindo como
prompt compilado determinístico para o runtime, mas deixa de ser usado como
fonte reversa dos campos do formulário.

## 2. Problemas corrigidos

- criação e edição agora enviam `version.configuration`;
- edição usa o detalhe do Assistant e a versão mais recente, em vez de depender
  do modelo parcial da listagem;
- todos os campos estruturados do Wizard são reidratados;
- `assistant.description` não é mais interpretada como objetivo;
- o `instructions` inteiro não é mais interpretado como tarefas;
- `displayName` usa o nome curto do Assistant, limitado a 120 caracteres;
- área/departamento fica em `configuration.identity.area`;
- `workspaceId` permanece separado como escopo técnico e não é exibido como
  área;
- versões antigas com `configuration: null` recebem fallback conservador;
- Knowledge Bases selecionadas são sincronizadas por diff nos endpoints de
  bindings;
- publicação só ocorre depois da sincronização completa dos bindings;
- falha de binding mantém o Assistant em draft e produz mensagem sanitizada;
- usuários sem `knowledge.bind` veem os vínculos em modo somente leitura e o
  Wizard não promete nem tenta alterá-los;
- MCP fica explicitamente fora do fluxo de binding do Wizard nesta fase;
- “Ordenar por” no catálogo passa a quebrar linha no mobile;
- stepper e scores passam a compartilhar um único container sticky com scroll;
- cards de revisão e ações do Wizard empilham em viewports estreitos.

## 3. Contrato de `version.configuration`

O contrato implementado possui `schemaVersion: 1` e é produzido por uma
projeção allowlistada. IDs de Knowledge e MCP, credenciais, tokens, cookies,
headers e secrets não são gravados nesse JSON.

```json
{
  "schemaVersion": 1,
  "identity": {
    "area": "",
    "environment": ""
  },
  "objective": {
    "main": "",
    "tasks": "",
    "prohibitedTasks": ""
  },
  "persona": {
    "description": ""
  },
  "voice": {
    "tone": "",
    "humor": "",
    "formality": ""
  },
  "rules": {
    "behavior": "",
    "restrictions": "",
    "criticalInstructions": ""
  },
  "model": {
    "fallbackModel": ""
  },
  "tools": {
    "approvalActions": ""
  },
  "format": {
    "responseFormat": ""
  },
  "examples": {
    "positive": "",
    "negative": ""
  },
  "limits": {
    "limits": "",
    "escalationPolicy": ""
  }
}
```

Versões legadas editadas podem acrescentar:

```json
{
  "legacy": {
    "instructions": "conteúdo anterior preservado sem split heurístico"
  }
}
```

Esse campo opcional evita perda do prompt antigo sem fingir que seu conteúdo
corresponde a objetivo, tarefas, regras ou outro campo estruturado.

## 4. Serialização e compilação

As funções testáveis estão em
`frontend/src/pages/Assistants/assistantWizard.serialization.ts`:

- `serializeWizardForm(formData)`;
- `compileAssistantInstructions(configuration)`;
- `hydrateWizardForm(assistant, bindings)`;
- `hydrateLegacyWizardForm(assistant, bindings)`;
- `parseWizardConfiguration(value)`;
- `inferModelProvider(modelName)`.

O compilador gera seções rotuladas em ordem estável:

1. Identidade;
2. Objetivo;
3. Persona;
4. Tom e Voz;
5. Regras;
6. Modelo;
7. Ferramentas;
8. Formato;
9. Exemplos;
10. Limites;
11. instruções legadas preservadas, quando aplicável.

Campos vazios não geram subtítulos vazios. A edição lê o JSON estruturado, não
faz parse reverso do texto compilado.

## 5. Criação e edição

### 5.1 Criação

`POST /api/v1/assistants` recebe:

- `name`;
- `description`;
- `status: draft`;
- versão inicial com `displayName`, `instructions`, `modelProvider`,
  `modelName`, `temperature` e `configuration`.

Quando o usuário escolhe publicar, o Assistant ainda é criado como draft. Os
bindings são sincronizados primeiro e somente então o endpoint de publicação é
chamado.

### 5.2 Edição

Foi mantido o fluxo incremental existente:

1. `PATCH /assistants/:id` para metadados;
2. `POST /assistants/:id/versions` para a nova versão estruturada;
3. leitura e diff de Knowledge Bindings;
4. criação/reativação/remoção lógica dos bindings;
5. publicação opcional.

Esse caminho é a mudança de menor risco nesta fase, mas não é transacional.
Uma falha pode ocorrer depois do PATCH, da criação da versão ou de parte dos
bindings. O frontend mantém draft, não publica, informa erro sanitizado e,
quando a criação já produziu um ID, redireciona para a edição desse draft para
evitar que o retry crie outro Assistant. Um endpoint composto transacional
permanece melhoria futura.

## 6. Fallback legado

Quando `configuration` é nulo, inválido ou possui outra versão de schema:

- `name`, `description`, modelo principal e temperatura são preservados;
- Knowledge Bases vêm dos bindings reais habilitados;
- área, objetivo, tarefas, tom, regras, formato, exemplos e limites permanecem
  vazios/default;
- `workspaceId` não é convertido em área;
- descrição não é convertida em objetivo;
- `instructions` não é convertido em tarefas;
- o conteúdo legado é mantido separadamente e o Wizard mostra aviso discreto;
- ao salvar, o conteúdo anterior é compilado em seção legada explícita.

Não foi criado backfill e versões históricas não são reescritas.

## 7. Knowledge Bindings

A sincronização está isolada em
`frontend/src/pages/Assistants/assistantWizard.knowledge.ts`.

O diff considera:

- selecionado e já habilitado: nenhuma chamada;
- selecionado e ausente: cria binding;
- selecionado e desabilitado: reativa pelo POST idempotente já suportado no
  backend;
- não selecionado e habilitado: chama DELETE, que faz soft-disable;
- não selecionado e já desabilitado: nenhuma chamada.

O Wizard carrega bindings por
`GET /assistants/:id/knowledge-bindings`. A tabela de bindings é a fonte
canônica atual; `configuration` não guarda IDs de Knowledge.

O gate visual usa a permissão `knowledge.bind`. Sem ela, a seleção fica
desabilitada e o save preserva os vínculos, sem executar mutation de binding.

Nenhuma operação de binding executa embeddings, retrieval/RAG, provider,
Chat/AgentRun ou MCP.

## 8. MCP Tools

Bindings MCP não são criados, removidos, reativados ou executados pelo Wizard
18C. A etapa é informativa, com checkboxes desabilitados, e a revisão declara
que esses bindings não serão alterados.

`approvalActions` continua sendo um campo textual estruturado do contrato, mas
não autoriza nem executa ferramenta. Não houve chamada de discovery, readiness,
sandbox, servidor, tool ou provider MCP.

## 9. Responsividade

Correções objetivas, sem redesign:

- catálogo: label e opções de ordenação usam wrap e botões sem quebra interna;
- sidebar desktop: stepper, score e preview ficam em um único sticky com altura
  limitada e scroll;
- Wizard: padding menor no mobile;
- revisão: scores em uma coluna no mobile e três a partir de `sm`;
- resumo e checklist: uma coluna no mobile e duas a partir de `sm`;
- navegação: botões empilhados e com largura total no mobile.

Não foi executado Playwright/Cypress live nesta fase.

## 10. Arquivos criados

- `frontend/src/pages/Assistants/assistantWizard.serialization.ts`;
- `frontend/src/pages/Assistants/assistantWizard.knowledge.ts`;
- `frontend/src/pages/Assistants/assistantWizard.serialization.test.ts`;
- `frontend/src/pages/Assistants/assistantWizard.knowledge.test.ts`;
- `frontend/src/test/assistant-wizard-save-workflow.test.ts`;
- `docs/ai-orchestration/ui/ORCHESTRA_UI_CORRECAO_WIZARD_ASSISTANTS_18C.md`;
- `scripts/preflight-correcao-wizard-assistants-18c.sh` (18C.1);
- `scripts/smoke-correcao-wizard-assistants-18c.sh` (18C.1).

## 11. Arquivos alterados

- `frontend/src/pages/Assistants/AssistantWizardPage.tsx`;
- `frontend/src/pages/Assistants/AssistantsPage.tsx`;
- `frontend/src/services/assistants.service.ts`;
- `frontend/src/hooks/queries/useAssistants.ts`;
- `frontend/src/types/index.ts`;
- `docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md`;
- `docs/ai-orchestration/README.md`;
- `.github/workflows/ci.yml` (18C.1);
- `scripts/preflight-homologacao-ui-18a.sh` (18C.1);
- `scripts/smoke-homologacao-ui-18a.sh` (18C.1);
- `scripts/preflight-release-homologavel-17d.sh` (18C.1);
- `scripts/smoke-release-homologavel-17d.sh` (18C.1);
- `scripts/preflight-secrets-variaveis-17c.sh` (18C.1, regressão
  transitiva);
- `scripts/smoke-secrets-variaveis-17c.sh` (18C.1, regressão transitiva);
- `scripts/preflight-hardening-compose-nginx-17b.sh` (18C.1, regressão
  transitiva);
- `scripts/smoke-hardening-compose-nginx-17b.sh` (18C.1, regressão
  transitiva).

O backend funcional, Prisma schema e migrations não foram alterados.

## 12. Cobertura automatizada

Os testes adicionados cobrem:

- round-trip de todos os campos estruturados;
- Knowledge Bases reidratadas por bindings habilitados;
- binding desabilitado não reidratado;
- contrato sem IDs de Knowledge/MCP;
- ordem determinística das seções do prompt;
- fallback `configuration: null`;
- área diferente de `workspaceId`;
- descrição diferente de objetivo;
- instructions legado diferente de tarefas;
- criação, reativação e remoção lógica por diff;
- diff vazio sem mutations;
- payload de criação com `configuration`;
- `displayName` curto;
- Knowledge Bindings antes de publish;
- falha de binding sem publish e sem propagar detalhe bruto;
- edição com PATCH de metadados e POST de versão estruturada.

## 13. Validações de fechamento

### 13.1 Governança forward-compatible (18C.1)

A 18C é uma fase funcional governada: ela altera deliberadamente arquivos do
frontend do Wizard/Assistants, sem alterar backend funcional, Prisma schema ou
migrations. Por isso, os gates históricos 17D e 18A não podem exigir que
`backend/src` e `frontend/src` permaneçam idênticos indefinidamente.

Os quatro gates diretamente afetados (smoke/preflight 17D e 18A) agora
distinguem dois modos:

- `--dry-run`: mantém obrigatórios os checks de secrets, URLs de produção,
  fail-closed, deploy, Compose live, migration, MCP/provider real, embeddings,
  Chat/AgentRun externo e browser live; divergência do snapshot funcional
  histórico gera warning;
- `--strict-baseline`: além dos guardrails, exige a identidade integral do
  snapshot funcional original da própria fase e falha em qualquer divergência.

Os hashes 17D/18A não foram regravados. Eles continuam representando os
snapshots históricos e podem ser auditados explicitamente no modo estrito.

O smoke 17D preserva a regressão transitiva 17C → 17B → 17A → 16Z. Os gates
17C e 17B também continham a mesma rejeição genérica de qualquer diff em fonte
funcional e são steps independentes da CI; portanto receberam a mesma
separação de modos. Não foi removida nenhuma regressão nem alterado qualquer
guardrail de segurança.

O gate funcional da correção passa a ser:

- `scripts/preflight-correcao-wizard-assistants-18c.sh --dry-run`;
- `scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run`.

O preflight resolve um limite imutável da fase entre a base `ca7e3db` e o
commit que introduzir o próprio script. Enquanto os arquivos ainda não estão
commitados, ele usa a diferença do worktree contra a mesma base. Isso permite
validar que a 18C não alterou backend/Prisma e que o frontend ficou na
allowlist esperada, sem atribuir mudanças funcionais de fases futuras à 18C.
A CI usa checkout com histórico para preservar essa resolução.

O gate é estático, offline e read-only. Typecheck, build e testes direcionados
continuam comandos explícitos de validação, fora do corpo do smoke:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test -- \
  src/pages/Assistants/assistantWizard.serialization.test.ts \
  src/pages/Assistants/assistantWizard.knowledge.test.ts \
  src/test/assistant-wizard-save-workflow.test.ts
```

### 13.2 Inspeção da CI

O workflow `.github/workflows/ci.yml`:

- executa `scripts/smoke-release-homologavel-17d.sh --dry-run`;
- executa `scripts/smoke-homologacao-ui-18a.sh --dry-run`;
- passa a executar
  `scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run`;
- executa frontend typecheck e build;
- não executa a suíte de testes frontend;
- mantém testes backend governados, sem provider/MCP/embeddings externo;
- não executa deploy, Compose live, migration, curl de produção,
  Playwright/Cypress live ou scripts `--run-real`/`--execute-real`.

Com os baselines phase-aware, os steps 17D/18A e suas regressões transitivas
passam no contexto pós-18C. O workflow localmente reproduzido por seus gates,
typechecks e build fica apto a passar; a execução remota da CI somente ocorrerá
após eventual push, que não faz parte desta etapa.

| Comando | Resultado |
|---|---|
| `git diff --check` | PASS |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run build` | PASS |
| testes novos/relacionados | PASS, 9/9 |
| `npm --prefix backend run typecheck` | PASS |
| ESLint dos arquivos alterados/criados | PASS |
| `npm --prefix frontend run test` | 95/96; uma falha de baseline fora do escopo 18C |
| `scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run` | PASS |
| `scripts/preflight-correcao-wizard-assistants-18c.sh --dry-run` | PASS |
| `scripts/smoke-homologacao-ui-18a.sh --dry-run` | PASS; divergência funcional posterior é warning |
| `scripts/smoke-release-homologavel-17d.sh --dry-run` | PASS; divergência funcional posterior é warning |
| `scripts/preflight-homologacao-ui-18a.sh --dry-run` | PASS; divergência funcional posterior é warning |
| `scripts/preflight-release-homologavel-17d.sh --dry-run` | PASS; divergência funcional posterior é warning |

A falha da suíte frontend está em
`real-api-services.test.ts > returns an honest empty analytics state while the
real endpoint is unsupported`. O teste espera que `apiGet` não seja chamado,
mas a implementação já existente de `analyticsService.overview()` consulta
`/ai-observability/runtime-runs`. Nem o serviço de Analytics nem esse teste
possuem diff na 18C; a inconsistência foi preservada para não ampliar o escopo.
A suíte completa foi reexecutada na 18C.1 e confirmou 95/96, com exatamente
essa mesma e única falha preexistente de Analytics.

Os dry-runs 18A/17D confirmam ausência de rede, deploy, browser live,
migration, provider e MCP real. A identidade das fontes funcionais continua
disponível em `--strict-baseline`, mas não torna a CI futura vermelha quando
uma fase funcional governada possui seu próprio gate. O smoke/preflight 18C é
o gate específico da correção e mantém bloqueantes as fronteiras de escopo e
segurança.

## 14. Limites e riscos remanescentes

- PATCH de Assistant, POST de Version e mutations de binding continuam sem
  transação composta;
- um diff de múltiplos bindings pode falhar depois de alterações parciais;
- retry é seguro para criação/reativação porque o backend faz upsert lógico;
- versões legadas não recuperam campos que nunca foram persistidos;
- bindings MCP permanecem fora do Wizard;
- a correção responsiva precisa de homologação visual manual nos viewports
  previstos pela 18B;
- não foi feito backfill;
- não houve migration;
- não houve alteração do Prisma schema.

## 15. Confirmações de segurança e escopo

- nenhum deploy foi executado;
- nenhuma URL de produção foi chamada;
- nenhum provider externo foi chamado;
- nenhum MCP real foi chamado;
- nenhum embedding real foi executado;
- nenhum Chat/AgentRun foi executado;
- nenhum Playwright/Cypress live foi executado;
- nenhum cookie, token, header, secret ou `.env` foi registrado ou versionado;
- nenhum stage, commit ou push foi executado.

## 16. Próximos passos de homologação manual

1. criar um Assistant preenchendo todos os campos das 12 etapas;
2. vincular zero, uma e múltiplas Knowledge Bases;
3. salvar draft, reabrir e comparar campo a campo;
4. editar e remover/adicionar bindings, então reabrir;
5. publicar e confirmar que bindings já existiam antes da publicação;
6. abrir um Assistant legado com `configuration: null` e validar o aviso;
7. validar que nenhum UUID aparece como Área;
8. testar catálogo e Wizard em 320×568, 375×667, 768×1024,
   1024×768 e 1440×900;
9. testar zoom de 200% e conteúdo textual longo;
10. validar usuário sem `knowledge.bind`;
11. confirmar que a etapa MCP permanece somente informativa.
