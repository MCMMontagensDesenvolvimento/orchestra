# Orchestra Backend

Backend control plane foundation for Orchestra.

## Stack

- Node.js LTS
- TypeScript strict
- Express
- Prisma
- PostgreSQL
- Zod
- Pino + pino-http
- Vitest + Supertest

## Local Setup

```bash
npm install
npx prisma generate
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Validation

```bash
npm run typecheck
npm run test
npm run build
```

## Database

The initial Prisma schema uses UUID identifiers with PostgreSQL. UUID is used because it is native to PostgreSQL, supported by Prisma without extra generators, and stable for distributed creation across future services.

Run migrations in development with:

```bash
npx prisma migrate dev
```

Run the seed with:

```bash
npm run prisma:seed
```

## Current Scope

This foundation includes healthchecks, structured errors, request IDs, dev-only cookie session login, RBAC/ABAC helpers, audit recording, core listing endpoints, and minimal assistant create/update/list/read.

It does not implement Microsoft SSO, real AI providers, RAG, MCP, vector store, streaming runtime, or production deployment automation.
