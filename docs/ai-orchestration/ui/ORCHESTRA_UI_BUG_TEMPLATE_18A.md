# Orchestra — Templates de Achados e Evidências da UI — Fase 18A

## Regras

- um registro por categoria e comportamento;
- não corrigir o achado na 18A;
- não misturar fato observado com hipótese;
- não incluir secret, cookie, token, env, header de autorização, dado pessoal,
  conteúdo confidencial ou payload bruto;
- usar somente rota/método/status locais quando evidência de API for necessária;
- screenshots devem ser recortados e sanitizados;
- IDs devem ser únicos e vinculados ao item da matriz 18A;
- fase sugerida de correção não é autorização de implementação.

## Severidade

| Nível | Critério |
|---|---|
| S0 Crítica | acesso indevido grave, perda/corrupção ampla, secret exposto ou risco externo imediato |
| S1 Alta | fluxo principal bloqueado, permissão relevante violada ou mutation inconsistente |
| S2 Média | fluxo alternativo existe, impacto restrito ou feedback incorreto relevante |
| S3 Baixa | impacto pequeno, contornável e sem risco de dados/segurança |
| N/A | melhoria, ajuste visual ou dúvida sem severidade de defeito |

## Status/decisão

- `OPEN`: reproduzido e aguardando triagem;
- `NEEDS_EVIDENCE`: indício sem reprodução suficiente;
- `BLOCKED`: pré-condição ausente;
- `ACCEPTED_FOR_18B`: aceito para fase posterior;
- `REJECTED`: não reproduzido, duplicado ou comportamento esperado;
- `BUSINESS_DECISION`: depende de decisão de regra;
- `PASS`: evidência aprovada.

## 1. Bug funcional

```text
ID: BUG-FUNC-18A-____
Data/hora:
Executor:
Área:
Tela:
Rota local:
ID da matriz:
Perfil/role:
Workspace de teste:
Browser/viewport:

Pré-condições:
Dados descartáveis usados:

Passos para reproduzir:
1.
2.
3.

Resultado esperado:
Resultado obtido:
Reproduzibilidade: sempre | intermitente | uma vez
Frequência:
Impacto:
Severidade: S0 | S1 | S2 | S3

Evidência sanitizada:
- screenshot:
- vídeo:
- método/path/status local:
- log sanitizado:

Hipótese (não confirmada):
Risco de regressão:
Workaround conhecido:
Decisão:
Responsável pela triagem:
Fase de correção sugerida: 18B | backlog | outra
Achados relacionados:
```

## 2. Bug visual

```text
ID: BUG-VIS-18A-____
Data/hora:
Executor:
Área/tela:
Rota local:
ID da matriz:
Perfil:
Browser:
Viewport:
Zoom:
Tema:

Elemento:
Resultado visual esperado:
Resultado visual obtido:
Há perda funcional? sim | não
Há conteúdo oculto/cortado? sim | não
Impacto:
Severidade: S1 | S2 | S3

Passos:
1.
2.

Screenshot sanitizado:
Referência visual aprovada, se existir:
Comportamento em outro viewport/browser:
Hipótese (não confirmada):
Decisão:
Fase de correção sugerida: 18B | backlog
```

## 3. Bug de permissão

```text
ID: BUG-PERM-18A-____
Data/hora:
Executor:
Área/tela:
Rota local:
ID da matriz:
Usuário de teste anonimizado:
Role:
Permissões esperadas:
Permissões ausentes/relevantes:

Recurso/ação:
Comportamento esperado: oculto | desabilitado | 403 | permitido
Comportamento obtido:

Passos:
1.
2.
3.

Resultado do frontend:
Resultado do backend (somente status/code sanitizado):
Houve mutation? sim | não | desconhecido
Impacto:
Severidade: S0 | S1 | S2 | S3

Evidência sanitizada:
Hipótese (não confirmada):
Contenção necessária:
Decisão:
Responsável Security/Owner:
Fase de correção sugerida: 18B | fase de segurança
```

Não anexar JWT, cookie, headers, dump da sessão ou identificador pessoal.

## 4. Bug de integração API

```text
ID: BUG-API-18A-____
Data/hora:
Executor:
Área/tela:
Rota local da UI:
ID da matriz:
Perfil:

Ação na UI:
Método HTTP local:
Path relativo:
Status HTTP:
Código de erro sanitizado:
Request ID sanitizado, se permitido:

Resultado esperado:
Resultado obtido:
Estado visual após erro:
Retry funciona? sim | não | não testado
Houve duplicidade ou mutation parcial?:
Impacto:
Severidade: S0 | S1 | S2 | S3

Passos:
1.
2.
3.

Evidência sanitizada:
Hipótese (não confirmada):
Camada suspeita: frontend | API | contrato | dados | desconhecida
Decisão:
Fase de correção sugerida: 18B
```

Não registrar body sensível, headers, origin externa ou connection string.

## 5. Melhoria

```text
ID: MEL-18A-____
Data:
Autor:
Área/tela:
Rota local:
ID da matriz:
Perfil:

Comportamento atual correto:
Oportunidade:
Proposta:
Benefício esperado:
Público beneficiado:
Critério de sucesso:
Risco:
Esforço estimado: pequeno | médio | grande | desconhecido
Evidência:
Dependência de regra de negócio:
Decisão:
Prioridade:
Fase sugerida: backlog | 18B | outra
```

## 6. Ajuste visual

Usar quando não há quebra funcional e a mudança é refinamento, não bug.

```text
ID: AJ-VIS-18A-____
Data:
Autor:
Área/tela:
Rota local:
ID da matriz:
Browser/viewport/zoom:

Elemento:
Estado atual:
Ajuste sugerido:
Design token/componente relacionado:
Benefício:
Impacto funcional: nenhum
Screenshot sanitizado:
Referência aprovada:
Decisão:
Prioridade:
Fase sugerida:
```

## 7. Dúvida de regra de negócio

```text
ID: REGRA-18A-____
Data:
Autor:
Área/fluxo:
Tela/rota:
ID da matriz:
Perfil:

Cenário:
Comportamento observado:
Por que o esperado é ambíguo:

Alternativa A:
Impacto da alternativa A:
Alternativa B:
Impacto da alternativa B:
Outras alternativas:

Código/documento consultado:
Dados necessários para decisão:
Decisor: Product Owner | Security | Legal | Operações | outro
Prazo/impacto se não decidido:
Decisão:
Critério de aceite após decisão:
Fase sugerida:
```

Não classificar como bug antes da decisão.

## 8. Evidência de teste aprovado

```text
ID: EV-18A-____
Resultado: PASS
Data/hora:
Executor:
Sessão de homologação:
ID da matriz:
Área:
Tela:
Rota local:
Perfil/role:
Workspace anonimizado:
Browser/viewport:

Pré-condições:
Passos executados:
1.
2.
3.

Resultado esperado:
Resultado observado:
Estados cobertos: loading | empty | error | forbidden | success

Evidência sanitizada:
- screenshot:
- vídeo:
- método/path/status local:
- log:

Dados descartáveis criados:
Cleanup realizado:
Produção chamada: não
Deploy realizado: não
MCP real executado: não
Provider/embedding externo executado: não
AgentRun externo-capable executado: não
Secret coletado: não
Correção aplicada: não

Revisor:
Data da revisão:
Observações:
```

## 9. Evidência bloqueada/não executada

```text
ID: EV-18A-____
Resultado: BLOCKED | NOT_RUN
ID da matriz:
Área/tela/rota:
Perfil:
Motivo:
Pré-condição ausente:
Risco evitado:
Evidência disponível:
Decisão necessária:
Responsável:
Próxima fase sugerida:
```

Usar este modelo, por exemplo, para MCP remoto, provider externo, embeddings reais,
Chat/AgentRun ou perfil inexistente.

## 10. Resumo de triagem

```text
Sessão:
Data:
Total de evidências:
PASS:
FAIL:
BLOCKED:
NOT_RUN:

BUG-FUNC:
BUG-VIS:
BUG-PERM:
BUG-API:
MEL:
AJ-VIS:
REGRA:

S0:
S1:
S2:
S3:

Itens aceitos para 18B:
Itens que exigem decisão de negócio:
Itens que exigem Security:
Itens sem evidência suficiente:

Correções executadas na 18A: não
Deploy/produção: não
MCP/provider externo: não
Decisão GO/NO-GO:
Responsáveis:
```
