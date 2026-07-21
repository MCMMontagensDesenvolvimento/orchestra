# Orchestra runtime evals 16S

Esta pasta contem a matriz versionada, ficticia e provider-free da Fase 16S. Os casos sao dados de teste locais: nao representam conversas, documentos, endpoints, credenciais ou servicos corporativos reais.

## Arquivos

- `cases.chat-rag.json`: grounding RAG e ausencia de resposta fora da base;
- `cases.response-scope.json`: `knowledge_only` e `general_allowed`;
- `cases.mcp-readonly.json`: permissao read-only modelada, bloqueio por flag e bloqueio de escrita;
- `cases.corporate-readonly.json`: defaults fechados, egress, secretRef, escrita e leakage do adapter corporativo;
- `cases.security.json`: prompt injection, quota enforce e ausencia de payload bruto;
- `validate.mjs`: parser, validador de seguranca e avaliador deterministico sem dependencias externas.

## Contrato de um caso

Cada caso possui `id`, `category`, `objective`, `tags`, `input` sintetico e `expectation`. A expectativa comum exige execucao offline, nenhuma chamada a provider, MCP ou servico corporativo e `rawContentLogged=false`.

O modo offline calcula a decisao a partir de sinais estruturados, sem gerar texto com modelo. Tambem confere contratos estaticos ja implementados no backend e no frontend: quota antes do runtime, MCP fail-closed/read-only, sanitizacao e campos allowlistados de observabilidade.

## Execucao

```bash
scripts/evals-runtime-qualidade-16s.sh --dry-run
scripts/evals-runtime-qualidade-16s.sh --run-offline
scripts/evals-runtime-qualidade-16s.sh --report
```

`--dry-run` e o unico modo destinado ao CI e valida a matriz mais os contratos estaticos do codigo. `--run-offline` continua sem rede, banco, containers, provider ou tools; ele acrescenta a avaliacao deterministica dos casos. `--report` mostra apenas versao, contagens e nomes de gates, nunca as entradas dos casos.

## Regras de seguranca

- nenhuma URL e aceita nos casos;
- material com formato de credencial ou connection string reprova a suite;
- os campos proibidos sao usados somente como nomes de probes no caso de leakage;
- nenhum modo carrega `.env`, imprime environment, abre banco, chama rede ou executa migration;
- a permissao MCP do caso read-only e apenas uma decisao modelada; nenhuma tool e invocada.

Para criterios, politica de regressao e remediacao, consulte `docs/ai-orchestration/ORCHESTRA_EVALS_QUALIDADE_SEGURANCA_16S.md`.
