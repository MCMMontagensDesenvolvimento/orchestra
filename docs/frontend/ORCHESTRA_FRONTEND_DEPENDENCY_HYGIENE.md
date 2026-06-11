# Orchestra Frontend Dependency Hygiene

Status: atualizado na Fase 05F.

## Objetivo

Registrar o estado de dependencias do frontend, vulnerabilidades conhecidas e a decisao de nao executar upgrades major automaticos durante a Fase 05F.

## Snapshot Local

Comandos executados:

```bash
npm install
npm audit --audit-level=high
npm audit
npm outdated || true
```

Resultado:

- `npm install`: arvore atualizada, 466 pacotes auditados.
- `npm audit --audit-level=high`: sem vulnerabilidade alta.
- `npm audit`: 2 vulnerabilidades moderadas.
- `npm outdated`: varias majors disponiveis, incluindo React 19, React Router 7, Vite 8, Vitest 4, Tailwind 4, Recharts 3 e TypeScript 6.

## Vulnerabilidades Moderadas

`npm audit` reporta:

- `esbuild <=0.24.2`: advisory moderado sobre dev server.
- `vite <=6.4.1`: depende de versoes vulneraveis de `esbuild`.

O fix sugerido e:

```bash
npm audit fix --force
```

Esse comando instalaria `vite@8.0.16`, uma mudanca major e potencialmente quebravel. A Fase 05F nao aplicou esse upgrade automatico porque o escopo era reduzir debt tecnico de frontend com baixo risco, preservar Docker/API mode/mock mode e evitar churn de toolchain sem matriz dedicada.

## Decisao De Upgrade

Nao aplicar `npm audit fix --force` nesta fase.

Motivos:

- O audit de nivel alto passa.
- A vulnerabilidade reportada afeta principalmente superficie de dev server.
- O build de producao atual usa artefatos estaticos servidos por Nginx.
- Vite 8 tambem exige avaliar plugin React SWC, Vitest, config de build, Dockerfile e compatibilidade com Node/tooling.
- O frontend acabou de receber split por rota e validacoes fullstack; misturar upgrade major dificultaria isolamento de regressao.

## Dependencias Com Major Disponivel

Principais linhas observadas em `npm outdated`:

- `vite`: `5.4.21` atual/wanted, `8.0.16` latest.
- `@vitejs/plugin-react-swc`: `3.11.0` atual/wanted, `4.3.1` latest.
- `react` e `react-dom`: `18.3.1` atual/wanted, `19.2.7` latest.
- `react-router-dom`: `6.30.4` atual/wanted, `7.17.0` latest.
- `typescript`: `5.9.3` atual/wanted, `6.0.3` latest.
- `vitest`: `3.2.6` atual/wanted, `4.1.8` latest.
- `recharts`: `2.15.4` atual/wanted, `3.8.1` latest.
- `tailwindcss`: `3.4.19` atual/wanted, `4.3.0` latest.
- `zod`: `3.25.76` atual/wanted, `4.4.3` latest.

## Plano Seguro Recomendado

1. Criar fase propria para toolchain upgrade.
2. Atualizar Vite e plugin SWC em branch dedicada.
3. Rodar `npm run lint`, `npm run typecheck`, `npm run test -- --run`, `npm run build`.
4. Rebuildar `frontend/Dockerfile.prod`.
5. Revalidar compose dev/prod.
6. Repetir smoke fullstack.
7. Revalidar browser em desktop/mobile.
8. So entao considerar React Router 7, React 19, Tailwind 4, Recharts 3 e Vitest 4, preferencialmente em lotes separados.

## Guardrails

- Nao versionar secrets em `.env`.
- Nao expor provider keys ou runtime settings ao frontend.
- Manter `VITE_USE_MOCKS` como chave explicita de mock/API.
- Manter `npm audit --audit-level=high` como gate minimo ate a fase de upgrade major.
- Tratar warnings de React Router v7 como debt de upgrade, nao como erro runtime atual.

