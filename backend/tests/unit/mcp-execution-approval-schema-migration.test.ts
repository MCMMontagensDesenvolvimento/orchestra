import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = resolve(__dirname, '../..');
const structuralMigrationPath = resolve(
  backendRoot,
  'prisma/migrations/20260903120000_phase_18f_2e_1a_mcp_execution_approval/migration.sql',
);
const rbacMigrationPath = resolve(
  backendRoot,
  'prisma/migrations/20260903121000_phase_18f_2e_1a_mcp_execution_approval_rbac/migration.sql',
);

const executionApprovalPermissionKeys = [
  'mcp.execution_approvals.read',
  'mcp.execution_approvals.request',
  'mcp.execution_approvals.approve',
  'mcp.execution_approvals.reject',
  'mcp.execution_approvals.cancel',
] as const;

describe('MCP execution approval schema and migration', () => {
  it('versions the seven-state one-shot approval model without a tool-call foreign key', () => {
    const schema = readFileSync(resolve(backendRoot, 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(structuralMigrationPath, 'utf8');

    for (const status of ['pending', 'approved', 'claimed', 'rejected', 'cancelled', 'expired', 'consumed']) {
      expect(schema).toContain(`  ${status}`);
      expect(migration).toContain(`'${status}'`);
    }
    expect(schema).toMatch(/claimedByAgentRunId\s+String\?\s+@unique/);
    expect(schema).toMatch(/consumedByToolCallId\s+String\?/);
    expect(migration).toContain('mcp_execution_approvals_claimed_by_agent_run_id_key');
    expect(migration).not.toMatch(/FOREIGN KEY \("consumed_by_tool_call_id"\)/);
  });

  it('uses guarded updateMany operations for claim and consumption', () => {
    const repository = readFileSync(resolve(
      backendRoot,
      'src/modules/mcp/mcp-execution-approval.repository.ts',
    ), 'utf8');

    const claim = repository.slice(repository.indexOf('async claim'), repository.indexOf('findClaimedForGateway'));
    const consume = repository.slice(repository.indexOf('async consume'), repository.indexOf('correlateConsumedToolCall'));

    expect(claim).toMatch(/updateMany[\s\S]*status: 'approved'[\s\S]*expiresAt: \{ gt:/);
    for (const scopeField of [
      'tenantId',
      'workspaceId',
      'assistantId',
      'assistantVersionId',
      'mcpServerId',
      'mcpToolId',
      'assistantMcpBindingId',
    ]) {
      expect(claim).toContain(`${scopeField}: input.${scopeField}`);
      expect(consume).toContain(`${scopeField}: input.${scopeField}`);
    }
    expect(claim).toMatch(/assistantMcpBinding:[\s\S]*assistantId: input\.assistantId[\s\S]*mcpToolId: input\.mcpToolId/);
    expect(consume).toMatch(/updateMany[\s\S]*status: 'claimed'[\s\S]*consumedAt: null[\s\S]*expiresAt: \{ gt:/);
  });

  it('adds an idempotent environment-agnostic RBAC rollout migration', () => {
    expect(existsSync(rbacMigrationPath)).toBe(true);
    const migration = readFileSync(rbacMigrationPath, 'utf8');

    for (const permissionKey of executionApprovalPermissionKeys) {
      expect(migration).toContain(`'${permissionKey}'`);
    }
    for (const roleName of ['admin_platform', 'creator_owner', 'editor', 'consumer', 'auditor']) {
      expect(migration).toContain(`'${roleName}'`);
    }

    expect(migration).toContain('ON CONFLICT ("key") DO NOTHING');
    expect(migration).toContain('ON CONFLICT ("role_id", "permission_id") DO NOTHING');
    expect(migration).toContain('gen_random_uuid()');
    expect(migration).not.toMatch(/CREATE\s+EXTENSION/i);
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toMatch(/\bseed(?:-mcm)?\b/i);
    expect(migration).not.toMatch(/Leonardo Silva|leonardo\.silva@mcm\.eng\.br|\bmcm\b/i);

    for (const flag of [
      'MCP_REMOTE_EXECUTION_ENABLED',
      'RUNTIME_ALLOW_EXTERNAL_TOOLS',
      'AGNO_ALLOW_REMOTE_MCP',
      'AGNO_RUNTIME_HTTP_TOOLS_ENABLED',
      'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED',
    ]) {
      expect(migration).not.toContain(flag);
    }
  });

  it('preserves the exact seeded role matrix without creating roles or removing extra grants', () => {
    const migration = readFileSync(rbacMigrationPath, 'utf8');
    const governedRoles = new Set(['admin_platform', 'creator_owner', 'editor', 'consumer', 'auditor']);
    const grants = Array.from(migration.matchAll(/\('([^']+)', '([^']+)'\)/g))
      .map(([, roleName, permissionKey]) => [roleName, permissionKey] as const)
      .filter(([roleName]) => governedRoles.has(roleName))
      .map(([roleName, permissionKey]) => `${roleName}:${permissionKey}`)
      .sort();

    expect(grants).toEqual([
      'admin_platform:mcp.execution_approvals.approve',
      'admin_platform:mcp.execution_approvals.cancel',
      'admin_platform:mcp.execution_approvals.read',
      'admin_platform:mcp.execution_approvals.reject',
      'admin_platform:mcp.execution_approvals.request',
      'auditor:mcp.execution_approvals.read',
      'consumer:mcp.execution_approvals.read',
      'creator_owner:mcp.execution_approvals.cancel',
      'creator_owner:mcp.execution_approvals.read',
      'creator_owner:mcp.execution_approvals.request',
      'editor:mcp.execution_approvals.cancel',
      'editor:mcp.execution_approvals.read',
      'editor:mcp.execution_approvals.request',
    ]);
    expect(migration).toMatch(/INNER JOIN "roles"[\s\S]*existing_role\."name" = governed\."role_name"/);
    expect(migration).not.toMatch(/INSERT INTO "roles"/i);
  });

  it('leaves the structural approval migration byte-for-byte unchanged', () => {
    const structuralMigration = readFileSync(structuralMigrationPath);
    const checksum = createHash('sha256').update(structuralMigration).digest('hex');

    expect(checksum).toBe('02d122d12fd9071af474514f0b7c663c1f21c5aebd0fb2c41bb5268971b8a89e');
  });
});
