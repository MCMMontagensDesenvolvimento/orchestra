import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const backendRoot = process.cwd();
const schema = readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(
    backendRoot,
    'prisma/migrations/20260627164042_phase_11i_mcp_remote_catalog_schema/migration.sql',
  ),
  'utf8',
);

const prisma = new PrismaClient();

function modelBlock(modelName: string) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Model ${modelName} not found in schema.prisma`);
  return match[0];
}

describe('MCP remote catalog schema migration 11I', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('exposes the new remote catalog models through Prisma Client', () => {
    expect('mcpRemoteCatalogEntry' in prisma).toBe(true);
    expect('mcpRemoteCatalogApplyLedger' in prisma).toBe(true);
    expect(typeof prisma.mcpRemoteCatalogEntry.create).toBe('function');
    expect(typeof prisma.mcpRemoteCatalogApplyLedger.create).toBe('function');
  });

  it('keeps remote catalog entries fail-closed by schema defaults and SQL CHECKs', () => {
    const entry = modelBlock('McpRemoteCatalogEntry');

    expect(entry).toContain('allowRuntimeExecution  Boolean   @default(false)');
    expect(entry).toContain('sandboxOnly            Boolean   @default(true)');
    expect(entry).toContain('blockedByDefault       Boolean   @default(true)');
    expect(entry).toContain('requiresApproval       Boolean   @default(true)');
    expect(entry).toContain('approvalMode           String    @default("manual")');
    expect(entry).toContain('runtimeEnabled         Boolean   @default(false)');
    expect(entry).toContain('remoteExecutionEnabled Boolean   @default(false)');
    expect(entry).toContain('materializedMcpToolId  String?   @unique');
    expect(entry).toContain('@@unique([tenantId, workspaceId, mcpServerId, externalName])');

    expect(migration).toContain('CHECK ("allow_runtime_execution" = false)');
    expect(migration).toContain('CHECK ("sandbox_only" = true)');
    expect(migration).toContain('CHECK ("blocked_by_default" = true)');
    expect(migration).toContain('CHECK ("approval_mode" = \'manual\')');
    expect(migration).toContain('CHECK ("runtime_enabled" = false)');
    expect(migration).toContain('CHECK ("remote_execution_enabled" = false)');
    expect(migration).toContain(
      'CHECK ("lifecycle_status" IN (\'draft\', \'blocked\', \'approved_for_catalog\', \'active\', \'deprecated\', \'archived\'))',
    );
    expect(migration).toContain('CHECK ("source" IN (\'remote_discovery\'))');
    expect(migration).toContain('CHECK ("risk_level" IN (\'low\', \'medium\', \'high\', \'critical\'))');
    expect(migration).toContain('CHECK ("revision" > 0)');
  });

  it('adds scoped identity, reconciliation indexes and idempotent apply ledger constraints', () => {
    const ledger = modelBlock('McpRemoteCatalogApplyLedger');

    expect(ledger).toContain(
      '@@unique([tenantId, workspaceId, mcpServerId, idempotencyKey], map: "mcp_remote_catalog_apply_ledgers_scope_idempotency_key")',
    );
    expect(ledger).toContain(
      '@@unique([tenantId, workspaceId, mcpServerId, applyId], map: "mcp_remote_catalog_apply_ledgers_scope_apply_key")',
    );
    expect(ledger).toContain('schemaVersion      Int       @default(1)');

    expect(migration).toContain(
      'CREATE UNIQUE INDEX "mcp_remote_catalog_entries_tenant_id_workspace_id_server_id_key" ON "mcp_remote_catalog_entries"("tenant_id", "workspace_id", "server_id", "external_name")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "mcp_remote_catalog_apply_ledgers_scope_idempotency_key" ON "mcp_remote_catalog_apply_ledgers"("tenant_id", "workspace_id", "server_id", "idempotency_key")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "mcp_remote_catalog_apply_ledgers_scope_apply_key" ON "mcp_remote_catalog_apply_ledgers"("tenant_id", "workspace_id", "server_id", "apply_id")',
    );
    expect(migration).toContain(
      'CREATE INDEX "mcp_remote_catalog_entries_snapshot_hash_idx" ON "mcp_remote_catalog_entries"("snapshot_hash")',
    );
    expect(migration).toContain(
      'CREATE INDEX "mcp_remote_catalog_apply_ledgers_created_at_idx" ON "mcp_remote_catalog_apply_ledgers"("created_at")',
    );
    expect(migration).toContain('CHECK ("schema_version" > 0)');
    expect(migration).toContain(
      'CHECK ("status" IN (\'started\', \'applied\', \'partially_applied\', \'failed\', \'blocked\', \'no_changes\'))',
    );
  });

  it('keeps the migration isolated from operational MCP runtime surfaces', () => {
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|ALTER TABLE "knowledge_chunk_embeddings"|RENAME TO/);
    expect(migration).not.toContain('CREATE TABLE "mcp_tools"');
    expect(migration).not.toContain('CREATE TABLE "assistant_mcp_bindings"');
    expect(migration).not.toContain('CREATE TABLE "mcp_tool_calls"');

    expect(modelBlock('McpRemoteCatalogEntry')).not.toMatch(/secret|token|password|credential|baseUrl|Authorization/i);
    expect(modelBlock('McpRemoteCatalogApplyLedger')).not.toMatch(/secret|token|password|credential|baseUrl|Authorization/i);
  });
});
