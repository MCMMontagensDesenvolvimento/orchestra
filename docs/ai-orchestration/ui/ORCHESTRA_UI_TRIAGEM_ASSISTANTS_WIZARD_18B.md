# Orchestra — Triagem Read-only do Wizard de Assistants — Fase 18B

## 1. Identificação e escopo

- Sessão: `HOM-18B-001`.
- Fluxo: `18B.4 — Assistants catálogo e criação/edição de Assistant`.
- Branch analisada: `fase-18b-execucao-manual-homologacao-ui`.
- Data da triagem: `2026-07-27`.
- Resultado geral informado pela homologação: `PASS PARCIAL`.
- Natureza desta atividade: investigação estática e consultas locais somente leitura.
- Arquivo criado nesta atividade: somente este relatório.

Restrições respeitadas:

- nenhum código funcional foi alterado;
- nenhuma migration ou alteração no Prisma schema foi executada;
- nenhum deploy foi executado;
- nenhum Chat ou AgentRun foi executado;
- nenhum MCP real, provider externo ou embedding real foi executado;
- nenhum cookie, token, header de autorização, segredo ou payload bruto foi
  registrado;
- as consultas ao banco foram somente `SELECT`, com projeções técnicas mínimas.

## 2. Conclusão executiva

Os achados do Wizard têm uma causa principal comum: o formulário possui um
modelo rico, com dados das 12 etapas, mas não existe um contrato de round-trip
capaz de serializar e reidratar esse modelo sem perda.

Na criação:

1. o Wizard mantém todos os campos em um único `formData`;
2. `assistants.service.ts` projeta somente parte deles para o payload;
3. oito campos de texto são concatenados sem marcadores em
   `version.instructions`;
4. `version.configuration` não é enviado;
5. as seleções de Knowledge Base e MCP Tool não geram bindings;
6. a área/departamento escolhida não é enviada.

Na edição:

1. a tela usa a lista de Assistants, não a consulta de detalhe;
2. o mapper ignora `version.configuration`, mesmo que a API a devolva;
3. `assistant.description` é reutilizada como `objective`;
4. todo `version.instructions` é reutilizado como `tasks`;
5. os demais campos inexistentes no objeto mapeado voltam vazios ou para
   defaults;
6. `workspaceId` é apresentado como `area`;
7. `knowledgeBases` e `mcpTools` são sempre mapeados como arrays vazios.

O backend já possui o campo `assistant_versions.configuration` do tipo `jsonb`,
aceita um objeto em `version.configuration` na criação e na criação de novas
versões, persiste-o e o devolve. Portanto, o `null` observado não é limitação do
banco ou do DTO: o frontend simplesmente não envia o campo.

Também já existem endpoints separados para Knowledge Bindings. O Wizard não os
chama. O banco confirmou que o Assistant local `Teste 5` possui:

- uma versão publicada;
- `configuration IS NULL`;
- zero Knowledge Bindings;
- zero MCP Bindings;
- Execution Policy criada com defaults fail-closed;
- workspace técnico `Principal`;
- uma Knowledge Base ativa e elegível no mesmo workspace.

Não é necessária migration para corrigir a persistência estruturada proposta.
Não é recomendável tentar reconstruir automaticamente todos os campos antigos
a partir de `instructions`, pois os delimitadores semânticos já foram perdidos.

## 3. Frontend

### 3.1 Onde ficam os estados das 12 etapas

As 12 etapas são declaradas no array `steps` e todos os seus valores ficam em
um único estado React local:

- `steps`: `frontend/src/pages/Assistants/AssistantWizardPage.tsx:23`;
- `defaultFormData`: `frontend/src/pages/Assistants/AssistantWizardPage.tsx:38`;
- `currentStep`: `frontend/src/pages/Assistants/AssistantWizardPage.tsx:75`;
- `formData`: `frontend/src/pages/Assistants/AssistantWizardPage.tsx:76`;
- tipo completo: `frontend/src/types/index.ts:1169`.

Não há store externo, estado por etapa, draft local persistente ou form schema
com versionamento. Cada input atualiza uma chave de `formData`. Knowledge Bases
e MCP Tools são arrays de IDs alterados por `toggleArrayItem`.

### 3.2 Como o Wizard salva

`handleSave` encaminha o mesmo `formData` para:

- `useCreateAssistantMutation` na criação;
- `useUpdateAssistantMutation` na edição.

Referências:

- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:147`;
- `frontend/src/hooks/queries/useAssistants.ts:65`;
- `frontend/src/hooks/queries/useAssistants.ts:77`.

O parâmetro `publish` não altera o payload inicial. Ele faz o frontend criar ou
editar e, depois, chamar o endpoint de publicação.

### 3.3 Payload de criação atual

`buildAssistantPayload` monta:

```text
Assistant
├── name                 <- formData.name
├── description          <- formData.description || formData.objective
├── status               <- "draft"
└── version
    ├── displayName      <- formData.persona || "Initial draft"
    ├── instructions     <- concatenação de 8 campos
    ├── modelProvider    <- inferido somente por "claude" versus "openai"
    ├── modelName        <- formData.model
    └── temperature      <- Number(formData.temperature)
```

Referência:
`frontend/src/services/assistants.service.ts:288`.

Os campos que entram hoje em `version.instructions`, nesta ordem, separados
somente por duas quebras de linha, são:

1. `objective`;
2. `tasks`;
3. `rules`;
4. `restrictions`;
5. `criticalInstructions`;
6. `responseFormat`;
7. `limits`;
8. `escalationPolicy`.

Como não há títulos, marcadores ou estrutura, a operação não é reversível.

### 3.4 Campos que não são enviados na criação

| Etapa/campo | Destino atual | Consequência |
|---|---|---|
| `area` | nenhum | área/departamento é perdida |
| `prohibitedTasks` | nenhum | proibições não chegam nem ao prompt consolidado |
| `tone` | nenhum | volta vazio |
| `humor` | nenhum | volta ao default visual |
| `formality` | nenhum | volta ao default `formal` |
| `fallbackModel` | nenhum | mapper replica o modelo principal |
| `knowledgeBases` | nenhum | nenhum Knowledge Binding é criado |
| `mcpTools` | nenhum | nenhum MCP Binding é criado |
| `approvalActions` | nenhum | instrução de aprovação é perdida |
| `positiveExamples` | nenhum | exemplos positivos são perdidos |
| `negativeExamples` | nenhum | exemplos negativos são perdidos |
| `environment` | nenhum | depois é inferido de `status`, com semântica diferente |
| `configuration` | nunca construído | banco grava `NULL` |

`persona` é enviada como `version.displayName`, não como configuração de
persona. Isso mistura um nome curto de versão com um textarea potencialmente
longo. O DTO limita `displayName` a 120 caracteres.

### 3.5 Payload de edição atual

A edição faz duas mutations sequenciais:

1. `PATCH /assistants/:id`, apenas com `name`, `description` e `status`;
2. `POST /assistants/:id/versions`, com a mesma projeção parcial usada na
   criação.

Referência:
`frontend/src/services/assistants.service.ts:338`.

Não há transação entre essas duas requisições. Se o `PATCH` funcionar e a
criação da versão falhar, o Assistant pode ficar com metadados alterados sem a
nova versão correspondente.

Nenhum dos dois payloads contém Knowledge Bindings, MCP Bindings ou
`configuration`.

### 3.6 Como a edição reidrata o formulário

O Wizard chama `useAssistants()` e localiza o ID na lista:

- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:65`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:73`.

Ele não usa `useAssistant(id)`, embora esse hook de detalhe exista. Quando o
registro chega, `getFormFromAssistant` reconstrói `formData` a partir do tipo
plano `Assistant`.

Referência:
`frontend/src/pages/Assistants/AssistantWizardPage.tsx:48`.

Antes disso, `mapAssistant` converte a resposta da API:

`frontend/src/services/assistants.service.ts:194`.

Mapeamentos que explicam diretamente os sintomas:

```text
area        <- assistant.workspaceId
objective   <- assistant.description
tasks       <- latestVersion.instructions
persona     <- latestVersion.displayName
model       <- latestVersion.modelName
fallback    <- latestVersion.modelName
knowledgeBases <- []
mcpTools       <- []
```

`configuration` existe em `ApiAssistantVersion`, mas não é lida por
`mapAssistant`. `getFormFromAssistant` então usa string vazia ou default para
campos ausentes.

### 3.7 Por que “Objetivo principal” recebe a descrição

É um mapeamento explícito:

`frontend/src/services/assistants.service.ts:217`.

```ts
objective: assistant.description ?? ''
```

Além disso, a criação usa `description || objective` para
`assistant.description`. Consequentemente, esse campo pode conter tanto a
descrição de identidade quanto o objetivo, mas a edição sempre o interpreta
como objetivo.

### 3.8 Por que “Tarefas” recebe conteúdo consolidado

É outro mapeamento explícito:

`frontend/src/services/assistants.service.ts:220`.

```ts
tasks: instructions
```

Como `instructions` contém oito seções concatenadas, todo o conteúdo reaparece
em “Tarefas que deve executar”.

### 3.9 Por que Tom/Regras/Formato/Exemplos/Limites voltam vazios

- Tom, humor e formalidade não são enviados em nenhum campo.
- Regras, restrições, formato e limites são enviados apenas dentro da string
  consolidada `instructions`, mas o mapper não tenta separá-los.
- Exemplos positivos e negativos não são enviados nem para `instructions`.
- `getFormFromAssistant` recebe propriedades ausentes e usa `''` ou defaults.

O mesmo problema alcança `prohibitedTasks`, `fallbackModel`,
`approvalActions`, `environment`, Knowledge Bases e MCP Tools.

### 3.10 Knowledge Base no Wizard

A seleção é apenas temporária:

```ts
formData.knowledgeBases: string[]
```

O checkbox adiciona/remove IDs do array em memória:

`frontend/src/pages/Assistants/AssistantWizardPage.tsx:357`.

`buildAssistantPayload`, `create` e `update` não leem esse array. Portanto, o
Wizard não envia nenhum payload para criar Knowledge Binding.

O fluxo funcional já implementado na tela de detalhe usa:

- `useCreateAssistantKnowledgeBindingMutation`;
- `knowledgeService.createAssistantBinding`;
- `POST /assistants/:id/knowledge-bindings`.

Referências:

- `frontend/src/pages/Assistants/AssistantDetailPage.tsx:281`;
- `frontend/src/hooks/queries/useKnowledge.ts:279`;
- `frontend/src/services/knowledge.service.ts:988`;
- `frontend/src/services/api/endpoints.ts:59`.

### 3.11 Fluxo esperado para bindings

Com os endpoints atuais, o fluxo mínimo para a 18C pode ser:

1. criar o Assistant em draft e obter seu ID;
2. para cada Knowledge Base selecionada, chamar
   `POST /assistants/:id/knowledge-bindings`;
3. confirmar todos os resultados;
4. somente depois publicar, se o usuário escolheu “Publicar”;
5. em falha parcial, manter o Assistant em draft, mostrar quais vínculos
   falharam e oferecer retry idempotente;
6. na edição, consultar os bindings atuais, comparar com a seleção e criar,
   reativar ou desabilitar a diferença;
7. reidratar o passo “Conhecimento” a partir dos bindings habilitados reais, e
   não de um array sempre vazio ou de um snapshot antigo.

O endpoint de criação de binding já reutiliza um registro existente e atualiza
seus atributos, o que ajuda no retry. Ainda assim, o fluxo frontend com várias
requisições não é atomicamente transacional.

Uma alternativa mais forte é um comando backend composto, com
`knowledgeBindings` no DTO de criação/edição e transação após validar tenant,
workspace e permissões. Essa alternativa elimina o estado parcial, mas amplia o
contrato da API.

O mesmo desenho deve ser decidido para `mcpTools`; esta triagem não executou
MCP.

### 3.12 Área/departamento

O Wizard exibe uma lista estática de áreas de negócio, como Recursos Humanos,
Jurídico e Financeiro:

`frontend/src/pages/Assistants/AssistantWizardPage.tsx:183`.

Esse valor não é enviado. O backend associa o Assistant ao workspace do usuário
e devolve apenas `workspaceId`. O frontend então usa o UUID como `area`:

`frontend/src/services/assistants.service.ts:203`.

Há duas entidades conceitualmente diferentes:

- workspace técnico/escopo de autorização;
- área ou departamento de negócio escolhido no Wizard.

A 18C deve preservar ambas sem sobrecarga semântica:

- `workspaceId` continua sendo o escopo técnico;
- `configuration.identity.area` preserva a área/departamento;
- opcionalmente a API inclui `workspace: { id, name }` para apresentação do
  workspace;
- a revisão mostra o nome da área de negócio e, se necessário, o workspace em
  campo separado.

Se a decisão de produto for que “Área” significa workspace, então o Select deve
ser alimentado por `/workspaces` e enviar `workspaceId`; a lista estática atual
de departamentos deve ser removida ou renomeada.

### 3.13 Achados visuais/responsivos

Catálogo:

- o bloco “Ordenar por” usa `flex` sem `flex-wrap`, sem scroll horizontal
  explícito e com cinco botões;
- em viewport estreito, a soma do label e dos botões excede a largura.

Referência:
`frontend/src/pages/Assistants/AssistantsPage.tsx:232`.

Wizard:

- o stepper desktop é uma coluna fixa de `w-56` com 12 itens;
- o painel de scores possui um segundo `sticky` com `top-[420px]`, independente
  do primeiro `sticky`;
- no passo de revisão, scores usam `grid-cols-3`;
- resumo e checklist usam `grid-cols-2` sem breakpoint;
- card principal usa `p-6`, e a navegação mantém ações em uma única linha.

Referências:

- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:481`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:513`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:544`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:555`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:651`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:669`;
- `frontend/src/pages/Assistants/AssistantWizardPage.tsx:693`.

Essas classes são compatíveis com os sintomas observados. A confirmação visual
já veio da homologação; esta triagem não alterou nem reexecutou a UI.

## 4. Backend

### 4.1 Contratos relevantes

| Endpoint | Comportamento confirmado |
|---|---|
| `POST /api/v1/assistants` | aceita `version.configuration` como objeto |
| `POST /api/v1/assistants` | não aceita Knowledge Bindings no contrato |
| `PATCH /api/v1/assistants/:id` | altera somente `name`, `description`, `status` |
| `POST /api/v1/assistants/:id/versions` | aceita e persiste `configuration` |
| `GET /api/v1/assistants` | retorna a versão mais recente, inclusive `configuration` |
| `GET /api/v1/assistants/:id` | retorna todas as versões, inclusive `configuration` |
| `GET /api/v1/assistants/:id/knowledge-bindings` | lista bindings separados |
| `POST /api/v1/assistants/:id/knowledge-bindings` | cria ou reativa binding |
| `PATCH /api/v1/assistants/:id/knowledge-bindings/:bindingId` | atualiza binding |
| `DELETE /api/v1/assistants/:id/knowledge-bindings/:bindingId` | desabilita binding |

Referências de DTO:

- `backend/src/modules/assistants/assistants.schema.ts:23`;
- `backend/src/modules/assistants/assistants.schema.ts:41`;
- `backend/src/modules/assistants/assistants.schema.ts:47`;
- `backend/src/modules/knowledge/knowledge.schema.ts:196`.

`validateBody` substitui o body pelo resultado do parse Zod. Como o schema de
criação não possui `knowledgeBindings`, um campo extra não é integrado ao
serviço:

`backend/src/shared/validation/validate.ts:4`.

### 4.2 Persistência de configuration

O repositório persiste `configuration` tanto na versão inicial quanto em novas
versões:

- `backend/src/modules/assistants/assistants.repository.ts:58`;
- `backend/src/modules/assistants/assistants.repository.ts:144`;
- `backend/src/modules/assistants/assistants.repository.ts:260`.

O mapper devolve o mesmo campo:

- `backend/src/modules/assistants/assistants.mapper.ts:47`;
- `backend/src/modules/assistants/assistants.mapper.ts:72`.

Logo:

- o backend preserva os dados estruturados que recebe;
- `configuration: null` ocorre quando o caller omite o campo;
- o frontend atual omite o campo na criação e na edição;
- o frontend também ignora o campo na resposta.

### 4.3 Versionamento

Uma edição do Wizard cria uma nova `AssistantVersion` por
`POST /assistants/:id/versions`. A linha anterior permanece no banco. A nova
versão preservará `configuration` se o frontend enviá-la.

O endpoint `PATCH /assistants/:id` não deve ser interpretado como atualização
da configuração versionada. Ele é somente para os metadados do Assistant.

O frontend atual executa `PATCH Assistant` e `POST Version` separadamente. O
backend não oferece uma transação que cubra essas duas chamadas.

### 4.4 Transações e criação composta

Na criação, o repositório usa um nested write do Prisma para criar em uma mesma
operação:

- `Assistant`;
- versão inicial;
- `AssistantExecutionPolicy`.

Referência:
`backend/src/modules/assistants/assistants.repository.ts:144`.

Não há Knowledge Binding nesse nested write nem transação composta
Assistant + Version + ExecutionPolicy + KnowledgeBindings.

Os bindings são gerenciados no módulo Knowledge, em operações separadas:

- rotas: `backend/src/modules/knowledge/knowledge.routes.ts:312`;
- validação de Assistant, Knowledge Base e workspace:
  `backend/src/modules/knowledge/knowledge.service.ts:2666`;
- persistência: `backend/src/modules/knowledge/knowledge.repository.ts:1770`.

### 4.5 Dados suficientes para reidratação

A resposta de Assistant já contém dados suficientes para reidratar:

- nome e descrição;
- versão mais recente;
- model provider/name;
- temperatura;
- `configuration`, quando preenchida.

Ela não contém, no mesmo payload:

- Knowledge Bindings;
- MCP Bindings;
- nome amigável do workspace;
- área/departamento de negócio, porque esse valor nunca foi persistido.

Assim, a edição completa deve combinar:

1. Assistant/versão mais recente;
2. Knowledge Bindings;
3. MCP Bindings, caso o passo continue funcional;
4. workspace ou sessão para nome amigável;
5. fallback legado quando `configuration` for nulo.

Além disso, o Wizard deveria usar `useAssistant(id)` no modo de edição ou um
endpoint agregado específico de edição. A lista hoje traz apenas a versão mais
recente e não é um contrato explícito de “edit model”.

## 5. Banco local — evidências somente leitura

### 5.1 Registro homologado

Foi encontrado o Assistant `Teste 5`. Identificadores completos foram omitidos
deste relatório por não serem necessários ao diagnóstico.

| Item | Resultado |
|---|---|
| nome | `Teste 5` |
| status | `published` |
| workspace | `Principal` |
| versões | 1 |
| versão | `0.1.0`, publicada |
| model provider/name | `openai` / `gpt-4o-mini` |
| temperatura | `0.70` |
| tamanho de `instructions` | 259 caracteres |
| `configuration` | `NULL` |
| Execution Policy | criada, defaults fail-closed |
| Knowledge Bindings | 0 |
| MCP Bindings | 0 |

Também foram encontrados `Teste 4`, `Teste 3`, `Teste 2` e `Teste`. Todas as
versões desses Assistants com prefixo `Teste` têm `configuration = NULL`.

`Teste 2` e `Teste` possuem um Knowledge Binding habilitado cada, demonstrando
que o vínculo separado funciona no mesmo ambiente. `Teste 5`, `Teste 4` e
`Teste 3` não possuem vínculo.

### 5.2 Knowledge Base elegível

No workspace `Principal` existe uma Knowledge Base local:

- nome: `Base Homologação 16I - RAG Operacional`;
- status: `active`;
- visibility: `workspace`;
- data classification: `internal`.

Portanto, a ausência de binding em `Teste 5` não decorre da inexistência de uma
base no workspace.

### 5.3 Tabelas relacionadas

As tabelas de binding encontradas no schema público são:

- `assistant_knowledge_bindings`;
- `assistant_mcp_bindings`.

Tabelas diretamente verificadas:

- `assistants`;
- `assistant_versions`;
- `assistant_execution_policies`;
- `assistant_knowledge_bindings`;
- `assistant_mcp_bindings`;
- `knowledge_bases`;
- `workspaces`;
- `information_schema.tables`;
- `information_schema.columns`.

O banco confirmou que `assistant_versions.configuration` já é `jsonb` nullable.

## 6. Diagnóstico por achado

| ID | Diagnóstico | Evidência principal | Causa raiz provável/confirmada | Severidade sugerida |
|---|---|---|---|---|
| `BUG-18B-001` | Knowledge binding não persistido | `Teste 5` tem 0 bindings; Wizard só altera array local | Confirmada: `knowledgeBases` não entra no payload e nenhuma mutation de binding é chamada | S2 Média |
| `BUG-18B-002` | Reidratação incompleta | mapper produz poucos campos e arrays vazios | Confirmada: não existe desserialização de `configuration`; edição usa modelo plano e defaults | S2 Média |
| `BUG-18B-003` | `configuration` nulo | banco e POST observado mostram `NULL` | Confirmada: frontend nunca constrói/envia `version.configuration`; backend suporta o campo | S2 Média |
| `BUG-18B-004` | Área exibida como UUID | `area <- workspaceId`; área escolhida não é enviada | Confirmada: mistura de workspace técnico com departamento de negócio | S2 Média |
| `BUG-18B-005` | Objetivo mapeado errado | `objective <- assistant.description` | Confirmada: atribuição explícita no mapper | S2 Média |
| `BUG-18B-006` | Campos livres vazios/default | campos ausentes ou irreversivelmente concatenados | Confirmada: projeção parcial na ida e mapper não inverso na volta | S2 Média |
| `BUG-18B-007` | Ajustes visuais/responsivos | homologação + classes sem wrap/breakpoints adequados | Muito provável: layouts rígidos e dois `sticky` independentes | S3 Baixa |

Relação causal:

- `BUG-18B-003` é uma causa estrutural de `BUG-18B-002` e
  `BUG-18B-006`;
- o mapper ad hoc agrava `BUG-18B-002`, `BUG-18B-004` e
  `BUG-18B-005`;
- `BUG-18B-001` é a mesma classe de falha de projeção aplicada a uma relação
  persistida em tabela própria.

## 7. Arquivos envolvidos

### 7.1 Frontend

| Arquivo | Responsabilidade no achado |
|---|---|
| `frontend/src/pages/Assistants/AssistantWizardPage.tsx` | estado das 12 etapas, reidratação, seleção temporária, layout e score |
| `frontend/src/services/assistants.service.ts` | payload parcial, mapper incorreto e sequência de update |
| `frontend/src/hooks/queries/useAssistants.ts` | mutations de criação/edição e queries invalidadas |
| `frontend/src/types/index.ts` | `Assistant`, `AssistantVersion` e `AssistantWizardFormData` |
| `frontend/src/services/api/endpoints.ts` | endpoints de versões e bindings |
| `frontend/src/services/knowledge.service.ts` | API real de Knowledge Bindings |
| `frontend/src/hooks/queries/useKnowledge.ts` | queries/mutations de Knowledge Bindings |
| `frontend/src/pages/Assistants/AssistantDetailPage.tsx` | fluxo de binding que funciona fora do Wizard |
| `frontend/src/pages/Assistants/AssistantsPage.tsx` | quebra mobile de “Ordenar por” |
| `frontend/src/services/workspaces.service.ts` | fonte disponível para nomes de workspace |
| `frontend/src/hooks/queries/useAdmin.ts` | hook existente de workspaces, hoje voltado ao admin |

### 7.2 Backend

| Arquivo | Responsabilidade no achado |
|---|---|
| `backend/src/modules/assistants/assistants.schema.ts` | DTOs de criação, update e versão |
| `backend/src/modules/assistants/assistants.routes.ts` | rotas separadas do Assistant e da versão |
| `backend/src/modules/assistants/assistants.controller.ts` | encaminhamento dos DTOs validados |
| `backend/src/modules/assistants/assistants.service.ts` | orquestração e auditoria |
| `backend/src/modules/assistants/assistants.repository.ts` | nested create e persistência de `configuration` |
| `backend/src/modules/assistants/assistants.mapper.ts` | retorno de versões e `configuration` |
| `backend/src/modules/knowledge/knowledge.schema.ts` | DTO de binding |
| `backend/src/modules/knowledge/knowledge.routes.ts` | endpoints separados de binding |
| `backend/src/modules/knowledge/knowledge.service.ts` | validação de escopo e regras de binding |
| `backend/src/modules/knowledge/knowledge.repository.ts` | create/reactivate/update/disable do binding |
| `backend/src/modules/workspaces/workspaces.service.ts` | retorno do nome amigável do workspace |
| `backend/src/shared/validation/validate.ts` | parse e projeção do body pelo Zod |

### 7.3 Prisma/tabelas

| Model Prisma | Tabela |
|---|---|
| `Assistant` | `assistants` |
| `AssistantVersion` | `assistant_versions` |
| `AssistantExecutionPolicy` | `assistant_execution_policies` |
| `AssistantKnowledgeBinding` | `assistant_knowledge_bindings` |
| `KnowledgeBase` | `knowledge_bases` |
| `AssistantMcpBinding` | `assistant_mcp_bindings` |
| `Workspace` | `workspaces` |

Referências:

- `backend/prisma/schema.prisma:341`;
- `backend/prisma/schema.prisma:383`;
- `backend/prisma/schema.prisma:572`;
- `backend/prisma/schema.prisma:608`;
- `backend/prisma/schema.prisma:886`;
- `backend/prisma/schema.prisma:1050`.

## 8. Proposta de correção para a Fase 18C

### 8.1 Definir um contrato versionado do Wizard

Usar `version.configuration` como fonte canônica da configuração editável e
`version.instructions` como prompt compilado para runtime.

Exemplo apenas estrutural:

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

Considerações:

- `name` e `description` continuam nos campos do Assistant;
- modelo principal e temperatura continuam nos campos próprios da versão;
- o fallback pode ficar em `configuration.model`;
- `knowledgeBases` e `mcpTools` devem ter bindings como fonte canônica atual;
- se IDs selecionados forem guardados em `configuration`, devem ser tratados
  apenas como snapshot histórico, nunca como substituto da tabela de bindings;
- não guardar secrets, credenciais, headers ou configurações privadas nesse
  JSON.

### 8.2 Criar funções explícitas e testáveis

Separar:

1. `serializeWizardForm(formData)` — produz metadados do Assistant,
   `version.configuration`, campos do modelo e intenções de bindings;
2. `compileAssistantInstructions(configuration)` — gera uma string com seções
   rotuladas e ordem estável;
3. `hydrateWizardForm(assistant, bindings, workspaces)` — reidrata a versão
   estruturada;
4. `hydrateLegacyWizardForm(assistant)` — fallback conservador para
   `configuration: null`.

O compilador deve incluir explicitamente:

- objetivo;
- tarefas permitidas;
- tarefas proibidas;
- persona;
- tom, humor e formalidade;
- regras, restrições e instruções críticas;
- formato;
- exemplos positivos e negativos;
- limites e escalonamento.

Mesmo com `instructions` completo, a edição deve ler os campos estruturados, não
tentar fazer parsing do prompt compilado.

### 8.3 Fallback seguro para versões antigas

Para `configuration: null`:

- nome, descrição, modelo e temperatura vêm dos campos atuais;
- `instructions` pode ser exibido em um campo legado ou importado para
  “Tarefas/instruções legadas” com aviso;
- não atribuir automaticamente descrição a objetivo;
- não tentar dividir `instructions` em regras, formato, limites e exemplos sem
  marcadores confiáveis;
- bindings atuais vêm dos endpoints de binding;
- ao salvar uma edição, criar nova versão com `schemaVersion: 1`, preservando a
  versão antiga sem mutação.

Não é necessário backfill obrigatório. Um backfill heurístico seria arriscado e
poderia inventar estrutura incorreta.

### 8.4 Sincronizar Knowledge Bindings antes de publicar

Opção incremental, sem novo endpoint:

1. criar/atualizar Assistant e versão em draft;
2. sincronizar bindings habilitados;
3. invalidar queries de Assistant, bindings e readiness;
4. publicar somente após sucesso;
5. manter draft e informar falhas em caso parcial.

Opção atômica:

- DTO/comando backend específico recebe Assistant, versão e Knowledge Bindings;
- valida todos os IDs, workspace e permissões;
- executa Assistant + Version + ExecutionPolicy + Bindings em transação;
- publica somente em uma etapa posterior.

Em ambas:

- checar permissão `knowledge.bind` antes de oferecer a seleção;
- diferenciar binding habilitado de registro apenas existente;
- testar reativação de binding previamente desabilitado;
- não executar embeddings como efeito colateral do vínculo.

### 8.5 Corrigir área e workspace

Decidir a semântica em produto e tornar o contrato explícito:

- recomendação: preservar departamento em
  `configuration.identity.area`;
- manter `workspaceId` separado;
- retornar ou consultar `workspace.name`;
- revisão deve exibir labels amigáveis, nunca UUID;
- filtros do catálogo devem usar a mesma origem de dados da apresentação.

### 8.6 Ajustar responsividade

Catálogo:

- aplicar `flex-wrap` com label em linha própria nos menores viewports; ou
- usar Select/Dropdown compacto no mobile; ou
- permitir scroll horizontal explícito com indicação visual.

Wizard:

- transformar scores da revisão em `grid-cols-1 sm:grid-cols-3`;
- usar `grid-cols-1 sm:grid-cols-2` em resumo/checklist;
- reduzir padding no mobile;
- permitir wrap/stack das ações de navegação;
- trocar os dois blocos `sticky` independentes por um único container sticky,
  com altura máxima e scroll quando necessário;
- validar alturas pequenas, zoom e conteúdo longo, não apenas largura.

## 9. Riscos e compatibilidade

### 9.1 Assistants existentes

- versões antigas continuarão com `configuration: null`;
- alterar o mapper sem fallback pode manter campos vazios ou deslocar conteúdo;
- não se deve reescrever versões históricas;
- `instructions` legado deve continuar utilizável pelo runtime;
- bindings atuais precisam prevalecer sobre snapshots antigos.

### 9.2 Migration

Não é necessária migration para a proposta principal:

- `assistant_versions.configuration` já existe;
- já é `jsonb`;
- já é nullable;
- DTO, repositório e mapper backend já suportam objeto.

Migration só seria necessária se a decisão de produto criar colunas ou tabelas
novas, por exemplo um catálogo formal de departamentos. Isso não é requisito
para a solução baseada em `configuration`.

### 9.3 Backfill

Não é obrigatório e não é recomendado como primeira medida.

A concatenação atual não possui marcadores de origem, e vários campos nunca
foram persistidos. Um backfill completo não pode recuperar com fidelidade:

- tom/humor/formalidade;
- tarefas proibidas;
- exemplos;
- fallback;
- área;
- seleções não vinculadas.

O caminho seguro é fallback em leitura e configuração estruturada somente nas
novas versões/edições.

### 9.4 Atomicidade e falhas parciais

- edição atual já pode falhar entre `PATCH Assistant` e `POST Version`;
- sincronizar vários bindings no frontend adiciona novas janelas de falha;
- publicar antes de sincronizar bindings reproduziria cobertura/RAG incorretos;
- um endpoint transacional composto reduz o risco, mas exige mais mudanças e
  testes de permissão/auditoria.

### 9.5 Permissões

Criar Assistant e criar Knowledge Binding usam permissões diferentes:

- `assistants.create`/`assistants.update`;
- `knowledge.bind`.

O Wizard deve refletir essa diferença. Não deve prometer que a base será
vinculada quando o usuário não possui a permissão necessária.

## 10. Testes necessários na 18C

### 10.1 Frontend unitário

- round-trip de todos os campos:
  `formData -> configuration -> formData`;
- compilação de `instructions` com seções e ordem determinística;
- `configuration: null` sem mapeamentos inventados;
- área de negócio separada de workspace;
- modelo principal versus fallback;
- bindings habilitados reidratando Knowledge e MCP;
- seleção/removal/reativação por diff;
- falha em um binding mantém draft e expõe retry;
- publicação somente depois da sincronização.

### 10.2 Backend/API

- criação persiste e retorna `version.configuration`;
- nova versão preserva objeto aninhado;
- GET list/detail mantém `configuration`;
- `PATCH /assistants/:id` não é usado para configuração versionada;
- criação/listagem/reativação/desabilitação de Knowledge Binding;
- rejeição cross-workspace;
- permissão `knowledge.bind`;
- transação e rollback, caso seja criado comando composto;
- audit metadata sem conteúdo livre sensível.

### 10.3 Integração/banco

- nova versão com `schemaVersion: 1`;
- versão anterior permanece inalterada;
- Assistant legado com `configuration NULL`;
- zero, uma e múltiplas bases;
- binding desabilitado não aparece como selecionado;
- readiness reflete somente bindings habilitados.

### 10.4 Responsividade/E2E

Viewports mínimos sugeridos:

- 320 × 568;
- 375 × 667;
- 768 × 1024;
- 1024 × 768;
- 1440 × 900.

Cenários:

- “Ordenar por” sem corte lateral;
- 12 passos com viewport baixo;
- scores e revisão em uma coluna no mobile;
- labels e conteúdo longos;
- zoom de 200%;
- navegação Anterior/Próximo/Salvar/Publicar;
- reabertura do Assistant e igualdade dos campos salvos.

Os testes da 18C devem continuar sem provider externo, MCP real, embeddings
reais ou Chat/AgentRun, salvo autorização específica de outra fase.

## 11. Comandos read-only executados

Categorias de comandos:

```text
pwd
git branch --show-current
git status --short
git log
rg / rg --files
find
sed
nl
docker ps
docker exec ... psql
```

Também foram lidos:

- fontes frontend/backend;
- Prisma schema;
- manifests de pacote;
- Compose local com valores sensíveis redigidos;
- documentos existentes da fase 18A.

Não foi executado `typecheck`, pois nenhum código funcional foi modificado.
Não foram executados testes de API/UI, pois a atividade era triagem read-only e
o fluxo de runtime estava explicitamente fora de escopo.

## 12. SELECTs executados

As consultas abaixo representam as projeções executadas. Nenhuma usou
`INSERT`, `UPDATE`, `DELETE`, DDL ou migration.

### 12.1 Assistants e workspace

```sql
SELECT
  a.id,
  a.name,
  a.status,
  a.workspace_id,
  w.name AS workspace_name,
  char_length(coalesce(a.description, '')) AS description_chars,
  a.created_at,
  a.updated_at
FROM assistants a
JOIN workspaces w ON w.id = a.workspace_id
WHERE a.deleted_at IS NULL
  AND (a.name ILIKE 'Teste 5%' OR a.name ILIKE 'Teste%')
ORDER BY a.updated_at DESC;
```

### 12.2 Versões e shape de configuration

```sql
SELECT
  a.name,
  av.id,
  av.version,
  av.status,
  av.display_name,
  av.model_provider,
  av.model_name,
  av.temperature,
  char_length(coalesce(av.instructions, '')) AS instructions_chars,
  av.configuration IS NULL AS configuration_is_null,
  jsonb_typeof(av.configuration) AS configuration_type,
  CASE
    WHEN jsonb_typeof(av.configuration) = 'object'
      THEN (
        SELECT array_agg(key ORDER BY key)
        FROM jsonb_object_keys(av.configuration) AS key
      )
    ELSE NULL
  END AS configuration_top_level_keys,
  av.created_at
FROM assistant_versions av
JOIN assistants a ON a.id = av.assistant_id
WHERE a.deleted_at IS NULL
  AND (a.name ILIKE 'Teste 5%' OR a.name ILIKE 'Teste%')
ORDER BY a.updated_at DESC, av.created_at DESC;
```

### 12.3 Execution Policies

```sql
SELECT
  a.name,
  aep.execution_mode,
  aep.requires_approval_to_publish,
  aep.sandbox_enabled,
  aep.sandbox_blocks_external_tools,
  aep.sandbox_blocks_real_providers,
  aep.allow_external_llm_providers,
  aep.allow_draft_testing,
  aep.allow_published_execution,
  aep.is_execution_enabled
FROM assistant_execution_policies aep
JOIN assistants a ON a.id = aep.assistant_id
WHERE a.deleted_at IS NULL
  AND (a.name ILIKE 'Teste 5%' OR a.name ILIKE 'Teste%')
ORDER BY a.updated_at DESC;
```

### 12.4 Knowledge Bindings

```sql
SELECT
  a.name,
  akb.id,
  kb.name AS knowledge_base_name,
  akb.is_enabled,
  akb.retrieval_mode,
  akb.priority,
  akb.created_at
FROM assistant_knowledge_bindings akb
JOIN assistants a ON a.id = akb.assistant_id
JOIN knowledge_bases kb ON kb.id = akb.knowledge_base_id
WHERE a.deleted_at IS NULL
  AND (a.name ILIKE 'Teste 5%' OR a.name ILIKE 'Teste%')
ORDER BY a.updated_at DESC, akb.priority, akb.created_at;
```

### 12.5 Knowledge Bases do workspace

```sql
SELECT
  w.name AS workspace_name,
  kb.name,
  kb.status,
  kb.visibility,
  kb.data_classification,
  count(akb.id) FILTER (WHERE akb.is_enabled) AS enabled_bindings,
  count(akb.id) AS total_bindings
FROM knowledge_bases kb
JOIN workspaces w ON w.id = kb.workspace_id
LEFT JOIN assistant_knowledge_bindings akb
  ON akb.knowledge_base_id = kb.id
WHERE kb.deleted_at IS NULL
  AND kb.workspace_id IN (
    SELECT workspace_id
    FROM assistants
    WHERE deleted_at IS NULL
      AND (name ILIKE 'Teste 5%' OR name ILIKE 'Teste%')
  )
GROUP BY w.name, kb.id, kb.name, kb.status, kb.visibility,
  kb.data_classification
ORDER BY kb.name;
```

### 12.6 Contagens de versões e bindings

```sql
SELECT
  a.name,
  count(DISTINCT av.id) AS version_count,
  count(DISTINCT akb.id) AS knowledge_binding_count,
  count(DISTINCT akb.id) FILTER (WHERE akb.is_enabled)
    AS enabled_knowledge_binding_count,
  count(DISTINCT amb.id) AS mcp_binding_count,
  count(DISTINCT amb.id) FILTER (WHERE amb.is_enabled)
    AS enabled_mcp_binding_count
FROM assistants a
LEFT JOIN assistant_versions av ON av.assistant_id = a.id
LEFT JOIN assistant_knowledge_bindings akb ON akb.assistant_id = a.id
LEFT JOIN assistant_mcp_bindings amb ON amb.assistant_id = a.id
WHERE a.deleted_at IS NULL
  AND (a.name ILIKE 'Teste 5%' OR a.name ILIKE 'Teste%')
GROUP BY a.id, a.name, a.updated_at
ORDER BY a.updated_at DESC;
```

### 12.7 Tabelas e coluna JSON

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%binding%'
ORDER BY table_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assistant_versions'
  AND column_name IN ('configuration', 'instructions', 'description')
ORDER BY ordinal_position;
```

## 13. Confirmações finais

- [x] nenhuma alteração de código funcional;
- [x] apenas este arquivo de relatório foi criado;
- [x] nenhuma migration;
- [x] nenhuma alteração no Prisma schema;
- [x] nenhum deploy;
- [x] nenhum provider externo;
- [x] nenhum MCP real;
- [x] nenhum embedding real;
- [x] nenhum Chat/AgentRun;
- [x] nenhuma mutation no banco;
- [x] nenhum secret, cookie, token ou header registrado/versionado;
- [x] nenhum commit;
- [x] nenhum stage;
- [x] nenhum push.

Saída final de `git status --short`:

```text
?? docs/ai-orchestration/ui/ORCHESTRA_UI_TRIAGEM_ASSISTANTS_WIZARD_18B.md
```

Não havia arquivo staged.
