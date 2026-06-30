import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { evaluateAiQualityTestCase } from '../../src/modules/ai-quality';

const tenantId = '00000000-0000-0000-0000-000000000010';

function evaluate(overrides: Partial<Parameters<typeof evaluateAiQualityTestCase>[0]> = {}) {
  return evaluateAiQualityTestCase({
    tenantId,
    inputText: 'How should Orchestra evaluate this answer?',
    candidateOutput: 'Orchestra can evaluate assistant quality with deterministic test assertions.',
    assertions: [{ type: 'contains_any', values: ['quality', 'score'] }],
    now: new Date('2026-06-30T12:00:00.000Z'),
    ...overrides,
  });
}

describe('AI quality deterministic evaluator', () => {
  it('passes contains_any when at least one expected term is present', () => {
    const result = evaluate({
      assertions: [{ type: 'contains_any', values: ['missing', 'QUALITY'] }],
    });
    expect(result.status).toBe('passed');
    expect(result.assertionResults[0]).toMatchObject({ type: 'contains_any', passed: true });
  });

  it('requires every term for contains_all', () => {
    const passing = evaluate({
      assertions: [{ type: 'contains_all', values: ['assistant', 'deterministic'] }],
    });
    const failing = evaluate({
      assertions: [{ type: 'contains_all', values: ['assistant', 'absent'] }],
    });

    expect(passing.status).toBe('passed');
    expect(failing.status).toBe('failed');
    expect(failing.assertionResults[0].reason).toBe('missing_expected_terms');
  });

  it('fails not_contains_any when a forbidden term appears', () => {
    const result = evaluate({
      assertions: [{ type: 'not_contains_any', values: ['deterministic'] }],
    });
    expect(result.status).toBe('failed');
    expect(result.assertionResults[0]).toMatchObject({ passed: false, reason: 'forbidden_term_found' });
  });

  it('evaluates min_length and max_length without floats', () => {
    const result = evaluate({
      candidateOutput: 'short answer',
      assertions: [
        { type: 'min_length', value: 5 },
        { type: 'max_length', value: 20 },
      ],
    });
    expect(result.status).toBe('passed');
    expect(Number.isInteger(result.scoreBasisPoints)).toBe(true);
    expect(result.scoreBasisPoints).toBe(10000);
  });

  it('evaluates regex_contains and regex_not_contains with safe bounded regex', () => {
    const result = evaluate({
      assertions: [
        { type: 'regex_contains', pattern: 'assistant\\s+quality', flags: 'i' },
        { type: 'regex_not_contains', pattern: 'provider\\s+api\\s+key', flags: 'i' },
      ],
    });
    expect(result.status).toBe('passed');
    expect(result.assertionResults).toHaveLength(2);
  });

  it('evaluates json_valid', () => {
    const valid = evaluate({
      candidateOutput: '{"status":"ok"}',
      assertions: [{ type: 'json_valid' }],
    });
    const invalid = evaluate({
      candidateOutput: '{"status":',
      assertions: [{ type: 'json_valid' }],
    });

    expect(valid.status).toBe('passed');
    expect(invalid.status).toBe('failed');
    expect(invalid.assertionResults[0].reason).toBe('json_invalid');
  });

  it('turns required assertion failures into failed', () => {
    const result = evaluate({
      assertions: [{ type: 'contains_any', values: ['absent'], severity: 'required' }],
    });
    expect(result.status).toBe('failed');
    expect(result.scoreBasisPoints).toBe(0);
  });

  it('turns warning-only assertion failures into warning', () => {
    const result = evaluate({
      assertions: [
        { type: 'contains_any', values: ['quality'], severity: 'required' },
        { type: 'contains_any', values: ['absent'], severity: 'warning' },
      ],
    });
    expect(result.status).toBe('warning');
    expect(result.scoreBasisPoints).toBe(5000);
  });

  it('returns passed when every assertion passes', () => {
    const result = evaluate({
      assertions: [
        { type: 'contains_any', values: ['quality'] },
        { type: 'not_contains_any', values: ['forbidden'] },
        { type: 'min_length', value: 10 },
      ],
    });
    expect(result.status).toBe('passed');
    expect(result.scoreBasisPoints).toBe(10000);
  });

  it('returns integer score basis points from 0 to 10000', () => {
    const result = evaluate({
      assertions: [
        { type: 'contains_any', values: ['quality'] },
        { type: 'contains_any', values: ['absent'], severity: 'warning' },
        { type: 'max_length', value: 1000 },
      ],
    });
    expect(Number.isInteger(result.scoreBasisPoints)).toBe(true);
    expect(result.scoreBasisPoints).toBeGreaterThanOrEqual(0);
    expect(result.scoreBasisPoints).toBeLessThanOrEqual(10000);
  });

  it('hashes candidateOutput with SHA-256 and returns only sanitized excerpt', () => {
    const candidateOutput = 'Result with Bearer secret-token and sk-testSecretValue that must be redacted.';
    const result = evaluate({
      candidateOutput,
      assertions: [{ type: 'contains_any', values: ['Result'] }],
    });

    expect(result.candidateOutputHash).toBe(createHash('sha256').update(candidateOutput).digest('hex'));
    expect(result.candidateOutputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.candidateOutputExcerpt).toContain('[redacted]');
    expect(result.candidateOutputExcerpt).not.toMatch(/secret-token|sk-testSecretValue/);
    expect(result).not.toHaveProperty('candidateOutput');
  });

  it('does not call fetch, LLM, MCP, runtime or Agno dependencies', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    evaluate();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('handles invalid regex without a raw crash', () => {
    const result = evaluate({
      assertions: [{ type: 'regex_contains', pattern: '[unterminated' }],
    });
    expect(result.status).toBe('failed');
    expect(result.assertionResults[0]).toMatchObject({ passed: false, reason: 'invalid_regex_pattern' });
  });

  it('rejects oversized candidateOutput before evaluation', () => {
    expect(() => evaluate({
      candidateOutput: 'x'.repeat(16001),
      assertions: [{ type: 'max_length', value: 16000 }],
    })).toThrow(/candidateOutput excede/);
  });
});
