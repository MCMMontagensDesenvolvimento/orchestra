# Orchestra — Hardening de produção e homologação do Runtime 16O

## Objetivo

A Fase 16O transforma o perfil produtivo versionado em uma base implantável e auditável sem mudar a semântica de Chat, RAG, Response Scope ou `AgentRun`. O trabalho corrige a incompatibilidade de pgvector, separa migrations do startup, integra o Agno bridge como opção explícita, adiciona proxy e healthchecks, exige secrets de sessão em produção e formaliza preflight, CI, backup, restore e rollback.

Nenhum deploy, migration nova, acesso a ambiente externo, provider externo, MCP remoto ou tool execution real faz parte desta fase.

## Escopo

- hardening direto de `docker-compose.prod.yml`;
- PostgreSQL 16 com pgvector e volume persistente explícito;
- healthchecks de banco, backend, frontend e Agno bridge;
- job e script separados para `prisma migrate deploy`;
- Nginx com health, proxy `/api/` e fallback SPA;
- validação fail-fast de `JWT_SECRET` em `NODE_ENV=production`;
- Agno bridge em profile opt-in, autenticado e fail-closed;
- preflight e smoke estáticos, não destrutivos;
- workflow mínimo de validação sem secrets ou deploy;
- procedimento operacional de backup, restore, deploy e rollback.

## Fora de escopo

- criar ou editar migrations e `backend/prisma/schema.prisma`;
- executar deploy, migration, backup ou restore real nesta entrega;
- provisionar infraestrutura, TLS, DNS, registry, secret manager ou observabilidade externa;
- habilitar provider externo, MCP remoto ou execução real de tools;
- automatizar downgrade de banco;
- alterar defaults de runtime da aplicação ou contratos funcionais existentes.

## Decisão sobre o compose produtivo

O arquivo existente `docker-compose.prod.yml` foi atualizado diretamente. A branch estava limpa, o arquivo já era o perfil produtivo oficial e criar um segundo compose `hardened` manteria dois caminhos concorrentes sujeitos a divergência. Os defaults continuam locais e fail-closed; ativação do bridge exige o profile `agno` e configuração explícita.

O Compose usa nomes de projeto e rede gerenciados pelo próprio Docker Compose e não declara `container_name`. Imagens de aplicação recebem tags configuráveis por `ORCHESTRA_FRONTEND_IMAGE`, `ORCHESTRA_BACKEND_IMAGE` e `ORCHESTRA_AGNO_BRIDGE_IMAGE`, o que permite promover e reverter artefatos imutáveis. Os valores `:local` servem apenas para build controlado do repositório.

## Arquitetura produtiva esperada

```text
cliente / ingress TLS
        |
        v
frontend Nginx :80
  | /health
  | SPA estática
  + /api/* ----------------------+
                                  v
                            backend :3000
                              | /health/db
                              | runtime local (default)
                              |
                 profile agno | bearer obrigatório
                              v
                       agno-bridge :8091
                       stub por default
                              |
                              x tools/MCP/provider externo

backend + job migrate ------> PostgreSQL 16 + pgvector
                               volume db_data
```

TLS, WAF, rate limiting de borda e exposição pública pertencem ao ingress/plataforma. Somente o frontend publica porta no host; backend, banco e bridge permanecem na rede interna do Compose.

## Compose e serviços

| Serviço | Ativação | Readiness | Persistência/exposição |
| --- | --- | --- | --- |
| `frontend` | padrão | `GET /health` no Nginx | publica `5173:80`; artefato estático |
| `backend` | padrão | `GET /health/db`, incluindo `SELECT 1` | somente `expose: 3000` |
| `db` | padrão | `pg_isready` | volume nomeado `db_data`; sem porta no host |
| `agno-bridge` | `--profile agno` | `healthcheck.py` com bearer quando configurado | somente `expose: 8091`; sem volume |
| `migrate` | `--profile operations` e execução manual | status verificado pelo script após deploy | job efêmero; reutiliza a imagem do backend |

`restart: unless-stopped` é aplicado aos serviços contínuos. O job `migrate` usa `restart: "no"` e nunca é dependência de startup do backend.

## pgvector

Produção usa `pgvector/pgvector:0.8.3-pg16`, a mesma linha compatível já usada no desenvolvimento. Isso atende a migration existente que exige a extensão `vector`; não cria nem altera migration. Atualizações de tag devem passar por homologação, backup, restore testado e revisão das notas de PostgreSQL/pgvector.

O healthcheck `pg_isready` confirma aceitação de conexões. A readiness do backend em `/health/db` confirma também que a aplicação consegue executar uma consulta no banco.

## Variáveis e secrets obrigatórios

`.env.example` documenta nomes e valores não sensíveis. O `.env` real é ignorado pelo Git e serve apenas como opção local de injeção; em produção, preferir secret manager e variáveis efêmeras do orquestrador.

Obrigatórias para o perfil padrão:

- `POSTGRES_PASSWORD`: senha do banco, nunca versionada;
- `DATABASE_URL`: connection string completa, nunca exibida em scripts ou evidências;
- `JWT_SECRET`: segredo aleatório com ao menos 32 caracteres, sem placeholder;
- `FRONTEND_ORIGIN`: origem pública exata permitida pelo CORS;
- tags `ORCHESTRA_*_IMAGE`: tags imutáveis aprovadas para deploy, quando não houver build local.

O backend rejeita startup em `NODE_ENV=production` quando `JWT_SECRET` é curto, default ou placeholder. Desenvolvimento e testes mantêm seus valores locais controlados. O Compose também força `COOKIE_SECURE=true` e `DEV_LOGIN_ENABLED=false`.

Nunca registrar o conteúdo de `DATABASE_URL`, `JWT_SECRET`, bearer do bridge, API keys, cookies ou headers. Evidências devem mostrar somente presença/ausência, origem do secret, versão e timestamp.

## Nginx, proxy e health

O Nginx produtivo mantém o fallback SPA e encaminha `location ^~ /api/` para `http://backend:3000` sem reescrever o caminho. Assim, o build com `VITE_API_BASE_URL=/api/v1` chega ao backend como `/api/v1/...` no mesmo origin.

O proxy preserva `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Host` e `X-Forwarded-Proto`, define timeouts finitos e oculta `X-Powered-By`. `/health` é uma liveness local simples, sem dados sensíveis. O ingress externo deve fazer TLS e pode usar `/health` apenas na rede autorizada.

## Agno bridge

O bridge não sobe no perfil padrão. Para homologar o modo HTTP stub, configurar um bearer forte compartilhado e usar:

```bash
export RUNTIME_PROVIDER=agno_http
export AGNO_RUNTIME_HTTP_ENABLED=true
# AGNO_RUNTIME_HTTP_SECURITY_KEY deve vir do secret manager.
docker compose -f docker-compose.prod.yml --profile agno up -d
```

Regras da Fase 16O:

- `AGNO_BRIDGE_EXECUTION_MODE=stub` e provider `stub` por default;
- `AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY=true` nos dois lados;
- `/health`, `/capabilities` e `/runs` recebem autenticação quando a chave é exigida;
- `AGNO_BRIDGE_ALLOWED_MODELS` fica vazio até existir allowlist aprovada;
- tools ficam desabilitadas e `AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0`;
- tool gateway e MCP remoto ficam desabilitados;
- provider keys só podem vir de secret/env no bridge e nunca do repositório;
- chave ausente ou provider real sem credencial mantém o bridge misconfigured/fail-closed.

O modo `real` é apenas documentado como capacidade futura; não deve ser habilitado nesta fase. Sua homologação exige mudança aprovada, allowlist de modelos, credenciais no secret manager, análise de egress e novos testes de segurança.

## Migration deploy

Somente migrations existentes podem ser aplicadas. O comando permitido é `prisma migrate deploy`; `prisma migrate dev` e `db push` são proibidos em homologação/produção.

O script exige ambiente e confirmação exata, valida `DATABASE_URL` sem imprimi-la e verifica `prisma migrate status` depois do deploy:

```bash
scripts/prod-migrate-deploy.sh --dry-run --environment homologation
scripts/prod-migrate-deploy.sh --environment homologation --confirm deploy-homologation
```

Quando o banco pertence à rede do Compose, usar o job efêmero depois de disponibilizar a imagem do backend:

```bash
scripts/prod-migrate-deploy.sh --compose \
  --environment homologation \
  --confirm deploy-homologation
```

O runner `host` atende bancos gerenciados alcançáveis pelo executor. O runner `compose` usa o profile `operations`, inicia apenas dependências necessárias e nunca acopla migration ao `CMD` do backend. Nos dois casos, backup e teste de restore são gates externos obrigatórios.

## Preflight produtivo

O preflight estático não lê `.env` reais, não inicia containers e não acessa banco ou provider:

```bash
scripts/preflight-prod-runtime-16o.sh --dry-run
scripts/preflight-prod-runtime-16o.sh --dry-run --check-compose
```

`--check-compose` valida o modelo com valores sintéticos e `--no-env-resolution`; nenhum secret real é necessário. O preflight verifica pgvector, serviços, profiles, healthchecks, proxy, exemplos de env, fail-fast de sessão, roteiro de migration, smokes anteriores, ausência de `container_name`, padrões óbvios de credencial e imutabilidade do schema/migrations.

## Backup antes da migration

Todo deploy com migrations pendentes exige backup consistente e retenção definida pela política da organização. Exemplo para o PostgreSQL do Compose, executado apenas em ambiente autorizado:

```bash
umask 077
backup_file="orchestra-pre-migrate-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' \
  > "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
```

Guardar dump e checksum em storage cifrado com acesso auditado. Evidenciar tamanho, checksum, horário, versão do banco e responsável, nunca conteúdo ou credenciais.

## Restore testado

O backup só é evidência válida depois de restore em banco isolado de homologação, nunca sobre produção. Procedimento mínimo:

1. criar instância/banco vazio compatível com PostgreSQL 16 e pgvector;
2. conferir checksum antes de restaurar;
3. executar `pg_restore --exit-on-error --no-owner` no alvo isolado;
4. aplicar `prisma migrate status` e confirmar que não há migrations inesperadas;
5. executar health DB e smokes funcionais autorizados;
6. registrar duração, versão, contagens não sensíveis e resultado; destruir o clone conforme retenção.

Se o restore não for reproduzível, o deploy deve ser abortado.

## Sequência de homologação/deploy

1. fixar SHA do código e tags imutáveis das imagens;
2. obter secrets pelo canal aprovado e validar permissões mínimas;
3. executar typechecks, testes, build, smoke 16O e smokes 16N/16M/16K/16I;
4. executar preflight com `--check-compose`;
5. criar backup e concluir restore testado;
6. disponibilizar/puxar as imagens aprovadas ou executar build reproduzível;
7. executar `prod-migrate-deploy.sh` com confirmação explícita;
8. subir `db`, `backend` e `frontend`; adicionar `--profile agno` somente no cenário stub aprovado;
9. aguardar todos os healthchecks;
10. executar smoke pós-deploy e registrar evidências redigidas.

Esta sequência é documentação operacional; nenhum desses passos mutáveis foi executado na Fase 16O.

## Smoke pós-deploy e critérios de aborto

Validar no mínimo health do frontend, health DB do backend, autenticação, uma navegação read-only e os cenários funcionais sintéticos já homologados. Quando o profile Agno estiver ativo, validar `/health` e `/capabilities` pelo canal autenticado sem registrar o bearer.

Abortar antes de promover tráfego quando ocorrer qualquer item:

- preflight, typecheck, teste, build ou smoke com falha;
- backup ausente, checksum inválido ou restore não testado;
- migration divergente, falha ou inesperada;
- container unhealthy, reinício repetido ou erro de conexão com banco;
- secret ausente/fraco, exposição de credencial ou origem CORS incorreta;
- provider/tool/MCP externo ativado fora da aprovação;
- regressão em Chat/RAG/Response Scope/AgentRun ou incompatibilidade de contrato.

## Rollback

Rollback de aplicação usa tags imutáveis conhecidas. Reatribuir `ORCHESTRA_FRONTEND_IMAGE`, `ORCHESTRA_BACKEND_IMAGE` e, quando aplicável, `ORCHESTRA_AGNO_BRIDGE_IMAGE` às versões anteriores e subir com `--no-build`. Registrar tags antes/depois e motivo.

Migrations não recebem downgrade automático. Depois que uma migration foi aplicada, o caminho preferido é forward-fix compatível. Quando houver corrupção ou incompatibilidade irrecuperável, interromper escrita/tráfego e restaurar o backup validado conforme decisão de incidente. Nunca executar `migrate dev`, `db push`, SQL reverso improvisado ou restore sobre produção sem aprovação explícita.

Se apenas o bridge falhar, retornar `RUNTIME_PROVIDER=local`, `AGNO_RUNTIME_HTTP_ENABLED=false` e remover o profile `agno`, preservando tools/MCP desabilitados.

## CI/CD mínimo

`.github/workflows/ci.yml` executa em pull requests e pushes:

- instalação determinística e geração do Prisma Client, sem banco;
- backend typecheck e testes principais, incluindo secrets produtivos;
- frontend typecheck e build;
- preflight 16O e smokes 16O, 16N, 16M, 16K e 16I em dry-run.

O workflow não recebe secrets, não sobe banco, não aplica migrations, não inicia Compose, não chama provider, não executa tools e não faz deploy. Publicação de imagem, promoção e deploy devem ser workflows separados e aprovados quando a plataforma estiver definida.

## Checklist de homologação e evidências

- [ ] SHA e branch registrados;
- [ ] tags imutáveis de frontend/backend/bridge registradas;
- [ ] `git diff --check`, typechecks, testes e build verdes;
- [ ] preflight com Compose verde;
- [ ] smokes 16O, 16N, 16M, 16K e 16I verdes;
- [ ] secrets vindos do secret manager, sem conteúdo em log;
- [ ] pgvector e versão PostgreSQL confirmados;
- [ ] backup com checksum e retenção confirmados;
- [ ] restore em homologação concluído;
- [ ] `prisma migrate status` antes da decisão e depois do deploy registrado;
- [ ] healthchecks de banco/backend/frontend verdes;
- [ ] Agno ausente ou stub autenticado conforme cenário aprovado;
- [ ] tools, tool gateway e MCP remoto desabilitados;
- [ ] smoke pós-deploy e critérios de aceite registrados;
- [ ] tags e procedimento de rollback disponíveis.

Evidências permitidas: SHA, tags, nomes de checks, status, timestamps, checksums e contagens agregadas. Evidências proibidas: connection strings, secrets, tokens, cookies, headers, prompts, conteúdo RAG, payloads de provider e argumentos/outputs de tools.

## Comandos de validação

```bash
git diff --check
npm --prefix backend run typecheck
npm --prefix backend run test -- \
  tests/api/agent-runs.test.ts \
  tests/api/runtime-observability.test.ts \
  tests/unit/ai-observability.test.ts \
  tests/unit/runtime-assistant-spec-builder.test.ts \
  tests/unit/production-secrets.test.ts --run
npm --prefix frontend run typecheck
npm --prefix frontend run build
scripts/preflight-prod-runtime-16o.sh --dry-run --check-compose
scripts/smoke-hardening-producao-runtime-16o.sh --dry-run
scripts/smoke-custos-quotas-runtime-16n.sh --dry-run
scripts/smoke-observabilidade-runtime-16m.sh --dry-run
scripts/smoke-chat-rag-operacional-16k.sh --dry-run
scripts/smoke-knowledge-rag-16i.sh --dry-run
```

## Critérios de aceite

- compose produtivo válido, sem `container_name`, com pgvector, volumes e healthchecks;
- backend e banco não expostos diretamente pelo perfil produtivo;
- Nginx atende health, SPA e proxy relativo da API;
- production startup falha com `JWT_SECRET` fraco/default;
- migrations existentes têm job/script separado, confirmação e pós-status;
- Agno bridge é opt-in, autenticado, stub e sem tools/MCP por default;
- preflight e smoke são read-only e não dependem de secrets reais;
- backup, restore, rollback, critérios de aborto e evidências estão definidos;
- CI valida código e contratos sem deploy ou chamadas externas;
- schema Prisma, migrations e semântica de runtime permanecem inalterados.

## Riscos remanescentes

- TLS, ingress, registry, secret manager, rotação e HA dependem da plataforma escolhida;
- Compose é adequado à homologação e operação simples, não substitui um orquestrador com scheduler/auto-healing distribuído;
- backup agendado, PITR, retenção e restore automatizado ainda precisam de infraestrutura;
- não há deploy canário/blue-green, assinatura de imagem, SBOM ou scanner de vulnerabilidade no CI mínimo;
- healthchecks externos profundos permanecem desativados para não causar egress por default;
- bridge real, allowlist de modelos, budgets de provider e observabilidade de egress exigem fase aprovada;
- rollback de banco continua sendo restore/forward-fix operacional, não downgrade automático.
