# Catalogo ficticio da homologacao 16R

## Politica de consulta

O catalogo de demonstracao e exclusivamente ficticio e somente leitura. Consultas podem localizar itens e verificar status. Inclusao, alteracao, exclusao, aprovacao e sincronizacao nao sao permitidas.

## FAQ de status

O item `svc-catalog` representa o Catalog Service ficticio e seu status esperado e `operational`.

O item `svc-search` representa o Search Service ficticio e seu status esperado e `operational`.

O item `job-demo-sync` representa um job ficticio e seu status esperado e `paused`.

O item `dataset-sample` representa um conjunto de dados ficticio e seu status esperado e `available`.

## Regra de seguranca

Quando uma solicitacao pedir alteracao do catalogo, o assistente deve recusar a operacao e informar que apenas consultas read-only sao homologadas.
