# Orchestra - Bootstrap Real e Seeds Demo

Fase 09C / Sprint 18
Escopo: separar bootstrap real/idempotente de dados demonstrativos opcionais.

## Decisao Operacional

O comando padrao de seed do backend agora executa apenas bootstrap real minimo. Dados demo continuam disponiveis, mas exigem opt-in explicito e sao bloqueados em ambientes production-like.

## Bootstrap Real

O bootstrap padrao e executado por:

```bash
cd backend
npm run prisma:seed
```

Comandos equivalentes:

```bash
cd backend
npm run prisma:bootstrap
npx prisma db seed
```

O bootstrap cria ou atualiza de forma idempotente:

- tenant `orchestra-dev`;
- workspace `default`;
- usuario local de desenvolvimento `admin.dev@orchestra.local`;
- catalogo de permissions;
- roles padrao `admin_platform`, `creator_owner`, `editor`, `consumer`, `auditor`;
- vinculos role-permission;
- membership do admin no workspace;
- user role do admin como `admin_platform`.

O bootstrap padrao nao cria assistant demo, knowledge demo, documentos ficticios, vinculos MCP ficticios ou external identity Microsoft.

## Seed Demo Opcional

Dados demo sao controlados por opt-in. Para criar o assistant exemplo local:

```bash
cd backend
npm run prisma:seed:demo
```

Alternativas equivalentes:

```bash
cd backend
ORCHESTRA_SEED_DEMO=true npm run prisma:seed
SEED_DEMO_DATA=true npm run prisma:seed
npx tsx prisma/seed.ts --demo
```

O seed demo cria ou atualiza de forma idempotente:

- assistant `Assistant Foundation Example`;
- versao `0.1.0` com instrucoes dummy;
- configuracao marcada como `source=seed-demo` e `runtimeEnabled=false`.

## Guardrail Production-Like

O seed resolve o ambiente nesta ordem:

1. `ORCHESTRA_ENV`;
2. `APP_ENV`;
3. `NODE_ENV`;
4. `development` como fallback.

Se demo estiver solicitado e o ambiente for `production`, `prod`, `staging`, `homolog` ou `homologation`, o script falha fechado antes de criar dados demo.

Exemplo de validacao do bloqueio:

```bash
cd backend
ORCHESTRA_ENV=production ORCHESTRA_SEED_DEMO=true npm run prisma:seed
```

Resultado esperado: erro seguro informando que demo seed nao e permitido no ambiente.

## Idempotencia

Para validar idempotencia local:

```bash
cd backend
npm run prisma:seed
npm run prisma:seed
npm run prisma:seed:demo
npm run prisma:seed:demo
```

O resultado esperado e nao duplicar tenant, workspace, user, roles, permissions, memberships, user roles, assistant demo ou versao demo.

Consultas uteis no banco:

```sql
select slug, count(*) from tenants group by slug;
select tenant_id, slug, count(*) from workspaces group by tenant_id, slug;
select email, count(*) from users group by email;
select key, count(*) from permissions group by key;
select tenant_id, name, count(*) from roles group by tenant_id, name;
select assistant_id, version, count(*) from assistant_versions group by assistant_id, version;
```

## SSO Microsoft

O seed nao cria `ExternalIdentity`, provider tenant fake, provider user fake ou qualquer vinculo Microsoft artificial.

Usuarios reais devem ser vinculados pelo fluxo SSO Microsoft do backend. Em ambientes controlados, `MICROSOFT_SSO_AUTO_LINK_BY_EMAIL` pode ser usado temporariamente para o primeiro vinculo e deve ser desligado depois da vinculacao inicial.

Nao hardcode usuarios corporativos reais no seed padrao. Para homologa ou producao, prefira criacao/vinculo por SSO real e governanca administrativa.

## Logs e Segredos

O seed imprime apenas ambiente, tenant, workspace, admin local e se demo foi habilitado. Ele nao imprime senha, hash de senha, tokens, secrets, chaves de provider ou dados de SSO.

## Variaveis

| Variavel | Default | Uso |
| --- | --- | --- |
| `ORCHESTRA_ENV` | `development` | Ambiente operacional do seed. |
| `APP_ENV` | - | Fallback de ambiente quando `ORCHESTRA_ENV` nao existe. |
| `NODE_ENV` | - | Fallback final antes de `development`. |
| `ORCHESTRA_SEED_DEMO` | `false` | Habilita dados demo quando `true`. |
| `SEED_DEMO_DATA` | `false` | Alias de compatibilidade para habilitar dados demo. |

## Ambientes Recomendados

| Ambiente | Comando | Demo |
| --- | --- | --- |
| Test/local prototipo | `npm run prisma:seed:demo` | Permitido |
| Local real | `npm run prisma:seed` | Desligado por padrao |
| Homolog/staging | `ORCHESTRA_ENV=staging npm run prisma:seed` | Bloqueado |
| Producao | `ORCHESTRA_ENV=production npm run prisma:seed` | Bloqueado |

## Fora de Escopo

- Criar migration ou alterar schema Prisma.
- Criar external identity Microsoft fake.
- Popular RAG/MCP/LLM/runtime com dados ficticios.
- Habilitar providers externos.
- Remover mocks do frontend.
