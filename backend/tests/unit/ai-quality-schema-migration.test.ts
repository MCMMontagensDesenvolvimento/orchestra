import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backendRoot = process.cwd();
const schema = readFileSync(path.join(backendRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(
    backendRoot,
    'prisma/migrations/20260630130000_phase_13a_ai_quality_evaluation_foundation/migration.sql',
  ),
  'utf8',
);

function modelBlock(modelName: string) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Model ${modelName} not found in schema.prisma`);
  return match[0];
}

describe('AI quality evaluation foundation migration 13A', () => {
  it('creates test set, test case, evaluation run and evaluation result models', () => {
    expect(modelBlock('AiQualityTestSet')).toContain('@@map("ai_quality_test_sets")');
    expect(modelBlock('AiQualityTestCase')).toContain('@@map("ai_quality_test_cases")');
    expect(modelBlock('AiQualityEvaluationRun')).toContain('@@map("ai_quality_evaluation_runs")');
    expect(modelBlock('AiQualityEvaluationResult')).toContain('@@map("ai_quality_evaluation_results")');
  });

  it('stores controlled test content without prompt/response/provider secret fields', () => {
    const testCase = modelBlock('AiQualityTestCase');
    const result = modelBlock('AiQualityEvaluationResult');
    expect(testCase).toContain('inputText');
    expect(testCase).toContain('expectedOutput');
    expect(testCase).toContain('assertions        Json');
    expect(result).toContain('candidateOutputHash');
    expect(result).toContain('candidateOutputExcerpt');
    expect(`${testCase}\n${result}`).not.toMatch(/prompt|response|headers|cookie|apiKey|providerApiKey|secretRef|baseUrl|rawDocuments/i);
  });

  it('creates all four tables with foreign keys and lookup indexes', () => {
    expect(migration).toContain('CREATE TABLE "ai_quality_test_sets"');
    expect(migration).toContain('CREATE TABLE "ai_quality_test_cases"');
    expect(migration).toContain('CREATE TABLE "ai_quality_evaluation_runs"');
    expect(migration).toContain('CREATE TABLE "ai_quality_evaluation_results"');
    expect(migration).toContain('REFERENCES "tenants"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "workspaces"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "assistants"("id") ON DELETE');
    expect(migration).toContain('REFERENCES "ai_quality_test_sets"("id") ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES "ai_quality_evaluation_runs"("id") ON DELETE CASCADE');
    expect(migration).toContain('CREATE INDEX "ai_quality_test_sets_tenant_id_status_deleted_at_idx"');
    expect(migration).toContain('CREATE INDEX "ai_quality_evaluation_results_run_id_idx"');
  });

  it('enforces allowlists and score ranges with CHECK constraints', () => {
    expect(migration).toContain('CHECK ("status" IN (\'active\', \'disabled\', \'archived\'))');
    expect(migration).toContain('CHECK ("status" IN (\'created\', \'running\', \'completed\', \'failed\', \'cancelled\'))');
    expect(migration).toContain('CHECK ("mode" IN (\'manual_snapshot\', \'deterministic\'))');
    expect(migration).toContain('CHECK ("status" IN (\'passed\', \'failed\', \'warning\', \'error\', \'skipped\'))');
    expect(migration).toContain('"score_basis_points" >= 0 AND "score_basis_points" <= 10000');
    expect(migration).toContain('jsonb_typeof("assertions") = \'array\'');
    expect(migration).toContain('jsonb_typeof("assertion_results") = \'array\'');
    expect(migration).toContain('"candidate_output_hash" ~ \'^[a-f0-9]{64}$\'');
  });

  it('adds size and non-negative constraints without destructive SQL', () => {
    expect(migration).toContain('char_length("input_text") <= 8000');
    expect(migration).toContain('char_length("expected_output") <= 8000');
    expect(migration).toContain('"sort_order" >= 0');
    expect(migration).toContain('"total_cases" >= 0');
    expect(migration).not.toMatch(/^(?:DROP|TRUNCATE|DELETE|UPDATE)\b/m);
  });

  it('does not introduce scheduler, worker, dashboard, billing or provider execution surfaces', () => {
    expect(migration).not.toMatch(/scheduler|worker|queue|cron|dashboard|invoice|billing|webhook|slack|teams|whatsapp|provider_api_key|api_key|secret_ref|headers|cookie|raw_documents/i);
    expect(schema).not.toMatch(/AiQuality.*(Scheduler|Worker|Queue|Dashboard|Billing)/);
  });
});
