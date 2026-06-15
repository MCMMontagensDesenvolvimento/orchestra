# Orchestra Dependency Audit Baseline

Status: baseline limpo na Fase 07B.1.
Data: 2026-06-15.

## Objetivo

Registrar o baseline de auditoria de dependencias apos a correcao controlada da toolchain de backend e frontend.

## Gate Minimo

O gate minimo para dependencias Node.js do projeto e:

```bash
npm audit --audit-level=high
```

Esse gate deve passar em `backend/` e `frontend/` antes de avancar fases que alterem toolchain, build, testes ou Dockerfiles.

## Baseline Atual

| Area | Comando | Resultado |
| --- | --- | --- |
| Backend | `cd backend && npm audit --audit-level=high` | `found 0 vulnerabilities` |
| Frontend | `cd frontend && npm audit --audit-level=high` | `found 0 vulnerabilities` |

Dependencias relevantes apos a correcao:

| Area | Dependencias |
| --- | --- |
| Backend | `vitest@4.1.9`, `vite@8.0.16`, `tsx@4.22.4`, `esbuild@0.28.1` |
| Frontend | `vite@8.0.16`, `vitest@4.1.9`, `@vitejs/plugin-react-swc@4.3.1` |

## Vulnerabilidades Remediadas

| Area | Antes | Depois |
| --- | --- | --- |
| Backend | `npm audit --audit-level=high` falhava por cadeia `vitest`/`vite`/`esbuild` e `tsx` com `esbuild` vulneravel | Audit alto limpo |
| Frontend | `npm audit --audit-level=high` falhava por `vite <=6.4.1` dependendo de `esbuild` vulneravel | Audit alto limpo |

## Politica Operacional

- Nao usar `npm audit fix --force` sem fase dedicada, leitura do diff e matriz de regressao.
- Nao trocar package manager sem decisao tecnica explicita.
- Nao aceitar downgrade de ferramenta para contornar advisory.
- Registrar baseline antes/depois quando um advisory exigir upgrade major.
- Manter lockfiles versionados e auditaveis.

## Observacoes Nao Bloqueantes

- O build do frontend recomenda avaliar `@vitejs/plugin-react` no futuro caso nao haja necessidade de plugins SWC. A recomendacao nao bloqueou lint, typecheck, testes, build ou audit.
- O build Docker mostrou avisos de dependencias legadas indiretas e aviso de nova major do npm. Nao houve vulnerabilidade reportada apos instalacao.
- Upgrades de React, React Router, Tailwind, Recharts e TypeScript permanecem fora deste baseline e devem ser tratados em fases proprias.
