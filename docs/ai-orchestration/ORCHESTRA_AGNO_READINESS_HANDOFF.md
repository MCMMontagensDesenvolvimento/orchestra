# Orchestra Agno Readiness Handoff

Status: preparado na Fase 07A.

## Objetivo

Preparar o contrato para futura integracao com Agno sem tornar Agno dependencia obrigatoria do ambiente local.

## Estado Atual

`AgnoRuntimeAdapter` existe como stub/readiness.

Ele:

- valida flags de configuracao backend;
- expoe health `disabled` por padrao;
- expoe `misconfigured` quando habilitado sem configuracao completa;
- expoe capabilities planejadas;
- nao executa chamadas reais;
- nao exige pacote, container ou servico Agno;
- nao expõe secrets ao frontend.

## Variaveis

```env
AGNO_ENABLED=false
AGNO_BASE_URL=
AGNO_API_KEY=
AGNO_TIMEOUT_MS=30000
AGNO_HEALTHCHECK_ENABLED=false
```

`AGNO_API_KEY` deve permanecer somente no backend ou em secret manager futuro.

## Proxima Integracao

Para evoluir de stub para adapter real:

1. manter `RuntimeAdapter` como contrato;
2. manter precheck backend antes da execucao;
3. manter `RuntimeExecutionContext` sanitizado;
4. habilitar healthcheck real atras de feature flag;
5. criar testes que garantam nenhum secret em logs/auditoria;
6. preservar fallback seguro para provider local.

## Fora Do Escopo Atual

- Agno real em producao;
- LLM real;
- tool calling remoto;
- streaming final;
- provider externo obrigatorio.
