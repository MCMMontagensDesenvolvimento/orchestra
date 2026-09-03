import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = resolve(__dirname, '../..');

describe('MCP execution approval schema and migration', () => {
  it('versions the seven-state one-shot approval model without a tool-call foreign key', () => {
    const schema = readFileSync(resolve(backendRoot, 'prisma/schema.prisma'), 'utf8');
    const migration = readFileSync(resolve(
      backendRoot,
      'prisma/migrations/20260903120000_phase_18f_2e_1a_mcp_execution_approval/migration.sql',
    ), 'utf8');

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
});
