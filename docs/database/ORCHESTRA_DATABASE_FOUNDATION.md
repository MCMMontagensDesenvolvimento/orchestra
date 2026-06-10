# Orchestra Database Foundation

Status: operacional desde a Fase 04.

Este documento descreve a base PostgreSQL + Prisma criada para o backend real. O schema cobre o control plane inicial e reserva entidades estruturais para runtime futuro, sem executar IA, RAG, MCP ou providers externos nesta fase.

## Arquivos

- Schema Prisma: `backend/prisma/schema.prisma`.
- Seed: `backend/prisma/seed.ts`.
- Migration inicial: `backend/prisma/migrations/20260609170000_initial_foundation/migration.sql`.
- Exemplo de ambiente: `backend/.env.example`.

## Convencoes

- Banco: PostgreSQL.
- ORM: Prisma.
- IDs: UUID nativo.
- Campos no banco: `snake_case` via `@map` e `@@map`.
- Campos no TypeScript: `camelCase`.
- Timestamps: `created_at`, `updated_at` quando aplicavel.
- Soft delete inicial: `deleted_at` em tenants, workspaces, users e assistants.
- Escopo: `tenant_id` e, quando aplicavel, `workspace_id`.

UUID foi escolhido por ser suportado nativamente no PostgreSQL, funcionar bem com Prisma e reduzir acoplamento a sequencias centralizadas quando a arquitetura evoluir para servicos especializados.

## Grupos De Modelos

Identidade e governanca:

- `Tenant`
- `Workspace`
- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `WorkspaceMembership`
- `Session`
- `AuditLog`
- `Setting`

Assistentes:

- `Assistant`
- `AssistantVersion`
- `AssistantShare`

Entidades estruturais reservadas para fases futuras:

- `KnowledgeBase`
- `McpServer`
- `McpTool`
- `Conversation`
- `ConversationMessage`
- `AgentRun`
- `ToolCall`
- `ProviderConfig`
- `UsageRecord`

Essas entidades futuras existem para preservar forma de dados e relacoes, mas nao representam execucao real nesta fase.

## Seed

A seed cria um ambiente dummy de desenvolvimento:

- Tenant: `orchestra-dev`.
- Workspace: `default`.
- Usuario: `admin.dev@orchestra.local`.
- Roles: `admin_platform`, `creator_owner`, `editor`, `consumer`, `auditor`.
- Permissoes iniciais para usuarios, roles, permissions, tenants, workspaces, assistants, knowledge, MCP, audit e settings.
- Vinculo do usuario admin com role de plataforma.
- Membership do usuario admin no workspace default.
- Assistente dummy com versao `0.1.0`.

A senha dummy usada pela seed nao deve ser tratada como segredo de producao.

## Migracoes

Desenvolvimento:

```bash
cd backend
npm run prisma:migrate:dev
```

Deploy:

```bash
cd backend
npm run prisma:migrate:deploy
```

Seed:

```bash
cd backend
npm run prisma:seed
```

## Auditoria

A tabela `audit_logs` registra:

- tenant e workspace quando aplicavel.
- usuario ator.
- acao.
- entidade.
- id da entidade.
- metadados JSON opcionais.
- IP.
- user agent.
- request id.
- data de criacao.

Eventos implementados nesta fase: `dev_login`, `logout`, `assistant_created` e `assistant_updated`.

## Limites Atuais

- Nao ha politica final de retencao.
- Nao ha particionamento.
- Nao ha criptografia de campo aplicada pelo app.
- Nao ha vector store.
- Nao ha dados reais de providers de IA.
- Nao ha workers ou filas persistidas.
