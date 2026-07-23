# Orchestra — Endpoint de status read-only 16V

## Objetivo

A Fase 16V cria no próprio backend do Orchestra o primeiro alvo HTTP real, seguro e não sensível para a futura execução de `corporate.status.read`. Ela disponibiliza `GET /v1/status` e `GET /v1/status/availability`, preserva o `GET /health` existente e limita as respostas a um contrato operacional sanitizado.

Esta fase cria o alvo seguro. A Fase 16W avalia a primeira chamada supervisionada, mas adota a Opção C: prepara o harness e mantém a execução real bloqueada até existir ambiente HTTPS homologado e contrato compatível.

## Escopo

- módulo `backend/src/modules/status` sem acesso a banco ou provider;
- `GET /v1/status` para o resumo operacional;
- `GET /v1/status/availability` para o resumo de disponibilidade;
- resposta JSON estrita, somente leitura e não sensível;
- timestamp UTC em ISO 8601 gerado no momento da leitura;
- testes de API para sucesso, contrato, ausência de campos proibidos e métodos não permitidos;
- smoke 16V estático e offline;
- documentação da relação com as fases 16T e 16U.

## Fora de escopo

- executar MCP, `corporate.status.read`, discovery ou readiness remoto;
- configurar origem corporativa, egress, credencial ou `secretRef` real;
- chamar serviço, provider, OpenAI ou endpoint externo;
- criar mutation, persistência, cache, scheduler, retry ou telemetria detalhada;
- alterar Prisma schema, migrations ou dados;
- habilitar MCP remoto ou o adapter corporativo por default;
- mudar o contrato ou comportamento de `/health`;
- expor diagnóstico profundo ou payload bruto.

## Ambientes e URLs

| Ambiente | Frontend | Backend/API |
|---|---|---|
| Local | `http://localhost:5173` | `http://localhost:3000` |
| Produção prevista | `https://orchestra.mcm.eng.br` | `https://api.orchestra.mcm.eng.br` |

As URLs de produção são referências de topologia prevista, não configuração de origem MCP nem evidência de deploy ou disponibilidade.

## Contrato dos endpoints

| Método e path | Semântica | Resultado |
|---|---|---|
| `GET /v1/status` | estado operacional geral | `200 application/json` |
| `GET /v1/status/availability` | disponibilidade do endpoint | `200 application/json` |
| `POST`, `PUT`, `PATCH` ou `DELETE` nos dois paths | não suportado | `404` pelo middleware padrão |

O schema é estrito: `status` aceita somente `ok` ou `degraded`, `summary` é uma mensagem sanitizada de até 240 caracteres e `updatedAt` é uma data ISO 8601. A implementação atual retorna `ok`; `degraded` fica reservado para uma condição operacional parcial futura que continue segura e não sensível.

## Exemplos de resposta

`GET /v1/status`:

```json
{
  "status": "ok",
  "summary": "Orchestra operational",
  "updatedAt": "2026-07-22T19:40:05.000Z"
}
```

`GET /v1/status/availability`:

```json
{
  "status": "ok",
  "summary": "Orchestra availability endpoint operational",
  "updatedAt": "2026-07-22T19:40:05.000Z"
}
```

O valor de `updatedAt` é dinâmico; as datas acima ilustram apenas o formato.

## Campos permitidos

- `status`;
- `summary`;
- `updatedAt`.

Não há envelope, eco da requisição nem `requestId` no corpo desses endpoints. O header técnico `x-request-id` do middleware global pode continuar presente sem integrar o payload JSON.

## Campos proibidos

As respostas não podem conter usuário, e-mail, tenant, workspace, prompt, contexto, args, output, headers, cookies, `Authorization`, environment, stack trace, versões detalhadas de dependências, `DATABASE_URL`, connection string, secrets, API key, path interno, host privado, dados de banco ou métricas sensíveis.

Uma falha futura deve ser tratada pelo contrato de erro global, sem incorporar esses dados ao status operacional. A resposta de sucesso continua limitada aos três campos permitidos.

## Como testar localmente

Com as dependências instaladas, iniciar somente o backend local:

```bash
npm --prefix backend run dev
```

Em outro terminal:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/v1/status
curl -i http://localhost:3000/v1/status/availability
```

Os três requests devem retornar `HTTP 200` e JSON. Os dois paths 16V devem conter somente `status`, `summary` e `updatedAt`. A validação estática, sem rede, é:

```bash
scripts/smoke-endpoint-status-readonly-16v.sh --dry-run
```

## Relação com 16T e 16U

A 16T definiu o boundary governado do adapter corporativo, incluindo a única tool `corporate.status.read` e os paths fixos `/health`, `/v1/status` e `/v1/status/availability`. A 16U definiu o processo de homologação supervisionada, aprovação, execução única, evidências seguras e rollback.

A 16V não abre esse boundary: ela implementa localmente os dois paths de status que antes retornavam 404. Os gates de MCP remoto, execução read-only e adapter corporativo continuam fechados. A 16W preserva esse estado e documenta que o HTTP local e o contrato público estrito não podem ser forçados pelo adapter corporativo; a chamada real exige origem HTTPS homologada e contrato reconciliado sob a governança da 16U.

## Por que isso ainda não executa MCP real

Os endpoints são rotas HTTP passivas do backend. Eles não importam o client MCP, não chamam o gateway de tools, não resolvem `secretRef`, não fazem `fetch`, não usam provider e não alteram flags. Uma resposta a um GET local prova apenas o contrato do alvo; não prova que `corporate.status.read` foi executada.

A etapa de smoke 16V no CI lê arquivos versionados e roda somente em `--dry-run`; o teste de API usa Supertest no próprio processo. Não há `curl` live, container externo, segredo, chamada de tool ou acesso a banco nessas etapas.

## Critérios de aceite

- `/health` mantém o contrato anterior e responde `200`;
- `GET /v1/status` e `GET /v1/status/availability` respondem `200 application/json`;
- ambos os payloads contêm exatamente `status`, `summary` e `updatedAt`;
- `updatedAt` é uma string ISO válida;
- nenhum campo proibido aparece no payload de sucesso;
- não existem rotas status para `POST`, `PUT`, `PATCH` ou `DELETE`;
- não há chamada externa, provider, OpenAI ou MCP real;
- MCP remoto e adapter corporativo permanecem fail-closed por default;
- Prisma schema e migrations permanecem inalterados;
- testes, typechecks, build, smokes e evals obrigatórios ficam verdes.

## Rollback

1. remover o mount `/v1/status` de `backend/src/app/routes.ts`;
2. remover `backend/src/modules/status` e `backend/tests/api/status.test.ts`;
3. remover o step e o smoke 16V do CI;
4. reverter as referências documentais 16V;
5. executar novamente os typechecks, testes e smokes anteriores.

O rollback não requer migration, seed, limpeza de banco, revogação de segredo ou chamada externa, porque a fase não cria nenhum desses recursos. `/health` deve permanecer intacto durante todo o rollback.

## Riscos remanescentes

- o endpoint informa apenas disponibilidade superficial do processo, não saúde de banco ou dependências;
- `updatedAt` representa o instante da resposta, não o horário de uma checagem persistida;
- disponibilidade, TLS, DNS, ingress e roteamento dos domínios previstos de produção ainda exigem validação no ambiente;
- rate limiting, SLO, monitoração e proteção de borda continuam responsabilidades operacionais;
- um consumidor futuro ainda precisa reconciliar o contrato público `ok|degraded` da 16V com o contrato esperado pelo adapter 16T sem ampliar o payload exposto;
- esse consumidor deve manter sanitização, limite de resposta, egress e auditoria da 16T;
- a existência do alvo não autoriza ativar MCP remoto nem realizar a chamada fora de uma janela aprovada.

## Próximo passo sugerido

Fase 16W: preparação fail-closed da primeira execução supervisionada. Como o local é HTTP e o adapter exige HTTPS, `--run-once-local` não foi implementado e nenhuma chamada real ocorreu. O próximo ambiente elegível deve ser HTTPS homologado, com contrato compatível, gates mínimos temporários, evidências allowlistadas e rollback imediato conforme a 16U.
