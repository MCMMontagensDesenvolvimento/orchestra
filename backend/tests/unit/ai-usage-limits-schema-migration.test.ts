import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = process.cwd();
const schema = readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(
    backendRoot,
    'prisma/migrations/20260629180000_phase_12b_ai_usage_limit_policies/migration.sql',
  ),
  'utf8',
);
const repository = readFileSync(
  path.join(backendRoot, 'src/modules/ai-observability/ai-usage-limits.repository.ts'),
  'utf8',
);

function modelBlock(modelName: string) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Model ${modelName} not found in schema.prisma`);
  return match[0];
}

describe('AI usage limit policies migration 12B', () => {
  it('creates the policy model with bigint limits and soft delete', () => {
    const model = modelBlock('AiUsageLimitPolicy');
    expect(model).toContain('limitValue         BigInt');
    expect(model).toContain('warnThresholdValue BigInt?');
    expect(model).toContain('deletedAt          DateTime?');
    expect(model).toContain('@@map("ai_usage_limit_policies")');
  });

  it('enforces all allowlists, positive values and coherent scope targets', () => {
    expect(migration).toContain(
      'CHECK ("scope_type" IN (\'tenant\', \'workspace\', \'assistant\', \'user\'))',
    );
    expect(migration).toContain(
      'CHECK ("metric" IN (\'run_count\', \'total_tokens\', \'input_tokens\', \'output_tokens\', \'embedding_tokens\', \'cached_tokens\', \'estimated_cost_minor_units\', \'failed_run_count\', \'blocked_run_count\'))',
    );
    expect(migration).toContain('CHECK ("period" IN (\'minute\', \'hour\', \'day\', \'month\'))');
    expect(migration).toContain('CHECK ("mode" IN (\'monitor_only\', \'enforce\'))');
    expect(migration).toContain('CHECK ("status" IN (\'active\', \'disabled\'))');
    expect(migration).toContain('CHECK ("limit_value" > 0)');
    expect(migration).toContain('"warn_threshold_value" <= "limit_value"');
    expect(migration).toContain('"scope_type" = \'workspace\' AND "workspace_id" IS NOT NULL');
    expect(migration).toMatch(/"scope_type" = 'assistant'.*"assistant_id" IS NOT NULL/);
    expect(migration).toMatch(/"scope_type" = 'user'.*"user_id" IS NOT NULL/);
  });

  it('adds foreign keys and lookup indexes without destructive SQL', () => {
    expect(migration).toContain('REFERENCES "tenants"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "workspaces"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "assistants"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "users"("id") ON DELETE CASCADE');
    expect(migration).toContain(
      'CREATE INDEX "ai_usage_limit_policies_tenant_id_status_deleted_at_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "ai_usage_limit_policies_provider_model_idx"',
    );
    expect(migration).not.toMatch(/^(?:DROP|TRUNCATE|DELETE|UPDATE)\b/m);
  });

  it('aggregates only AiRunUsageEvent counters and bigint-safe sums', () => {
    expect(repository).toContain('FROM "ai_run_usage_events"');
    expect(repository).toContain('COUNT(DISTINCT "run_id")');
    expect(repository).toContain('SUM("${columns[metric]}")');
    expect(repository).toContain('::text AS "value"');
    expect(repository).toContain("return BigInt(rows[0]?.value ?? '0')");
    expect(repository).not.toMatch(/fetch\(|axios|Mcp|AgentOS|Agno/i);
  });

  it('does not add operational runtime, dashboard, billing or alert models', () => {
    const model = modelBlock('AiUsageLimitPolicy');
    expect(model).not.toMatch(/prompt|response|rawDocuments|headers|cookie|apiKey|secretRef|baseUrl/i);
    expect(migration).not.toMatch(/dashboard|invoice|billing|alert|notification|mcp_tools/i);
  });
});
