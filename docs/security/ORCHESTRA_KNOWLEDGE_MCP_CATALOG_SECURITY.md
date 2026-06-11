# Orchestra Knowledge/RAG/MCP Catalog Security

Status: implementado na Fase 06 para catalogo governado. A Fase 06B adicionou ingestao local textual com chunks e source references. Runtime real continua fora do escopo.

## Principios

- Backend e a autoridade de RBAC/ABAC.
- Frontend e apenas cliente de gestao.
- Secrets nao entram em `metadata`, `config`, schemas ou templates.
- Bindings devem respeitar tenant e workspace.
- MCP permanece bloqueado por padrao para runtime.

## RBAC

Permissoes adicionadas ao seed:

Knowledge:

- `knowledge.create`
- `knowledge.update`
- `knowledge.archive`
- `knowledge.restore`
- `knowledge.bind`
- `knowledge.ingestion.read`
- `knowledge.ingestion.manage`

MCP:

- `mcp.create`
- `mcp.update`
- `mcp.archive`
- `mcp.restore`
- `mcp.bind`
- `mcp.tools.read`
- `mcp.tools.manage`
- `mcp.policies.manage`

Permissoes preexistentes `knowledge.read`, `knowledge.manage`, `mcp.read` e `mcp.manage` continuam no seed para compatibilidade de papeis.

## ABAC

As regras de escopo verificam:

- tenant da sessao;
- workspaces acessiveis pela sessao;
- workspace explicito em filtros e payloads;
- consistencia de workspace entre assistant e recurso vinculado;
- ausencia de archive em recursos que receberiam binding novo.

Falhas retornam `403` ou `404` conforme o padrao do backend.

## Guard Contra Secrets

Schemas Zod rejeitam objetos JSON de catalogo com chaves sensiveis normalizadas:

- `secret`
- `secrets`
- `token`
- `tokens`
- `password`
- `apikey`
- `api_key`
- `authorization`
- `cookie`
- `privatekey`
- `private_key`

MCP prompt templates tambem rejeitam termos sensiveis como secret, token, password, api key e authorization.

## MCP Policy

Toda tool criada recebe policy estrutural:

- `allowRuntimeExecution=false`
- `sandboxOnly=true`
- `blockedByDefault=true`
- `requiresApproval` conforme risco, com alto/critico obrigatorios

Bindings MCP usam `sandbox_only` por padrao. Override para remover approval e bloqueado quando a tool e de risco alto/critico ou ja exige approval.

## Auditoria

Mutacoes de Knowledge/MCP, bindings e ingestao local registram eventos de auditoria sanitizados. A auditoria registra recurso, acao e metadados seguros, sem credenciais ou conteudo bruto.

## Fora Do Escopo

- SSO corporativo real.
- Secrets manager real.
- Execucao MCP.
- Chamadas a providers.
- Ingestao com arquivos binarios.
- Webhooks.
- Runtime de IA.
