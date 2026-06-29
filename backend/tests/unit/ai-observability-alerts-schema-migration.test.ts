import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = process.cwd();
const schema = readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(
    backendRoot,
    'prisma/migrations/20260629210000_phase_12d_ai_observability_alert_rules/migration.sql',
  ),
  'utf8',
);
const repository = readFileSync(
  path.join(backendRoot, 'src/modules/ai-observability/ai-observability-alerts.repository.ts'),
  'utf8',
);

function modelBlock(modelName: string) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Model ${modelName} not found in schema.prisma`);
  return match[0];
}

describe('AI observability alert rules migration 12D', () => {
  it('creates the alert rule model with bigint threshold and soft delete', () => {
    const model = modelBlock('AiObservabilityAlertRule');
    expect(model).toContain('thresholdValue    BigInt');
    expect(model).toContain('cooldownMinutes   Int?');
    expect(model).toContain('deletedAt         DateTime?');
    expect(model).toContain('@@map("ai_observability_alert_rules")');
  });

  it('enforces all allowlists, non-negative values and coherent scope targets', () => {
    expect(migration).toContain(
      'CHECK ("scope_type" IN (\'tenant\', \'workspace\', \'assistant\', \'user\'))',
    );
    expect(migration).toContain(
      'CHECK ("metric" IN (\'event_count\', \'run_count\', \'total_tokens\', \'input_tokens\', \'output_tokens\', \'embedding_tokens\', \'cached_tokens\', \'estimated_cost_minor_units\', \'avg_latency_ms\', \'failed_run_count\', \'blocked_run_count\'))',
    );
    expect(migration).toContain('CHECK ("period" IN (\'minute\', \'hour\', \'day\', \'month\'))');
    expect(migration).toContain('CHECK ("operator" IN (\'gt\', \'gte\', \'eq\'))');
    expect(migration).toContain('CHECK ("severity" IN (\'info\', \'warning\', \'critical\'))');
    expect(migration).toContain('CHECK ("status" IN (\'active\', \'disabled\'))');
    expect(migration).toContain('CHECK ("threshold_value" >= 0)');
    expect(migration).toContain('CHECK ("cooldown_minutes" IS NULL OR "cooldown_minutes" >= 0)');
    expect(migration).toContain('"scope_type" = \'tenant\' AND "workspace_id" IS NULL');
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
      'CREATE INDEX "ai_observability_alert_rules_tenant_id_status_deleted_at_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "ai_observability_alert_rules_provider_model_idx"',
    );
    expect(migration).not.toMatch(/^(?:DROP|TRUNCATE|DELETE|UPDATE)\b/m);
  });

  it('aggregates only AiRunUsageEvent counters and bigint-safe values', () => {
    expect(repository).toContain('FROM "ai_run_usage_events"');
    expect(repository).toContain('COUNT(*)');
    expect(repository).toContain('COUNT(DISTINCT "run_id")');
    expect(repository).toContain('ROUND(AVG("latency_ms"))');
    expect(repository).toContain('::text AS "value"');
    expect(repository).toContain("return BigInt(rows[0]?.value ?? '0')");
    expect(repository).not.toMatch(/fetch\(|axios|Mcp|AgentOS|Agno/i);
  });

  it('does not add delivery, scheduler, dashboard, billing or runtime surfaces', () => {
    const model = modelBlock('AiObservabilityAlertRule');
    expect(model).not.toMatch(/prompt|response|rawDocuments|headers|cookie|apiKey|secretRef|baseUrl/i);
    expect(migration).not.toMatch(/dashboard|invoice|billing|notification|webhook|slack|teams|whatsapp|scheduler|worker|queue|cron|mcp_tools/i);
  });
});
