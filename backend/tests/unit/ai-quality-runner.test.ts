import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  buildAiQualityAssistantSnapshot,
  buildAiQualityRunSummary,
  buildAiQualityTestSetSnapshot,
  canonicalizeAiQualitySnapshot,
  evaluateAiQualityTestSetDeterministically,
  hashAiQualitySnapshot,
  validateAiQualityCaseOutputs,
} from '../../src/modules/ai-quality';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const assistantId = '00000000-0000-0000-0000-000000000101';
const testSetId = '00000000-0000-0000-0000-000000001301';
const testCaseIdA = '00000000-0000-0000-0000-000000001302';
const testCaseIdB = '00000000-0000-0000-0000-000000001303';
const now = new Date('2026-06-30T16:00:00.000Z');

function testSetFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: testSetId,
    workspaceId,
    assistantId,
    name: 'Deterministic quality set',
    status: 'active',
    deletedAt: null,
    assistant: {
      id: assistantId,
      workspaceId,
      name: 'Quality Assistant',
      status: 'published',
    },
    testCases: [
      {
        id: testCaseIdA,
        assistantId,
        name: 'Required contains',
        inputText: 'Explain quality.',
        assertions: [{ type: 'contains_any', values: ['quality'] }],
        status: 'active',
        sortOrder: 1,
        deletedAt: null,
      },
      {
        id: testCaseIdB,
        assistantId,
        name: 'Warning term',
        inputText: 'Avoid forbidden terms.',
        assertions: [{ type: 'not_contains_any', values: ['forbidden'], severity: 'warning' }],
        status: 'active',
        sortOrder: 2,
        deletedAt: null,
      },
    ],
    _count: { testCases: 3 },
    ...overrides,
  } as any;
}

describe('AI quality deterministic run runner', () => {
  it('calculates run counters and integer average score basis points', () => {
    const summary = buildAiQualityRunSummary([
      { status: 'passed', scoreBasisPoints: 10000 },
      { status: 'warning', scoreBasisPoints: 5000 },
      { status: 'failed', scoreBasisPoints: 0 },
      { status: 'skipped', scoreBasisPoints: 0 },
      { status: 'error', scoreBasisPoints: 0 },
    ]);

    expect(summary).toEqual({
      totalCases: 5,
      passedCases: 1,
      failedCases: 1,
      warningCases: 1,
      errorCases: 1,
      skippedCases: 1,
      scoreBasisPoints: 3750,
    });
  });

  it('canonicalizes snapshots before hashing', () => {
    const a = { b: 2, a: { d: 4, c: 3 } };
    const b = { a: { c: 3, d: 4 }, b: 2 };

    expect(canonicalizeAiQualitySnapshot(a)).toBe(canonicalizeAiQualitySnapshot(b));
    expect(hashAiQualitySnapshot(a)).toBe(createHash('sha256').update(canonicalizeAiQualitySnapshot(a)).digest('hex'));
    expect(hashAiQualitySnapshot(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('builds sanitized assistant and test set snapshots', () => {
    const assistantSnapshot = buildAiQualityAssistantSnapshot({
      id: assistantId,
      workspaceId,
      name: 'Quality Assistant',
      status: 'published',
    }, now);
    const testSetSnapshot = buildAiQualityTestSetSnapshot(testSetFixture(), now);

    expect(assistantSnapshot.summary).toEqual({
      assistantId,
      workspaceId,
      name: 'Quality Assistant',
      status: 'published',
      capturedAt: now.toISOString(),
    });
    expect(testSetSnapshot.summary).toMatchObject({
      testSetId,
      workspaceId,
      assistantId,
      testCaseCount: 3,
      activeTestCaseCount: 2,
      capturedAt: now.toISOString(),
    });
    expect(assistantSnapshot.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(testSetSnapshot.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify({ assistantSnapshot, testSetSnapshot })).not.toMatch(/secret|credential|rawDocuments|baseUrl/i);
  });

  it('rejects duplicated, missing and out-of-test-set case outputs', () => {
    const testSet = testSetFixture();
    expect(() => validateAiQualityCaseOutputs(testSet, [
      { testCaseId: testCaseIdA, candidateOutput: 'quality' },
      { testCaseId: testCaseIdA, candidateOutput: 'quality again' },
    ])).toThrow(/duplicado/);

    expect(() => validateAiQualityCaseOutputs(testSet, [
      { testCaseId: testCaseIdA, candidateOutput: 'quality' },
    ])).toThrow(/Todos os test cases ativos/);

    expect(() => validateAiQualityCaseOutputs(testSet, [
      { testCaseId: testCaseIdA, candidateOutput: 'quality' },
      { testCaseId: '00000000-0000-0000-0000-000000009999', candidateOutput: 'other' },
    ])).toThrow(/fora do test set/);
  });

  it('evaluates a test set without returning or preparing full candidate output for persistence', () => {
    const candidateOutput = `${'quality answer '.repeat(40)}TAIL_FULL_OUTPUT_SHOULD_NOT_PERSIST`;
    const result = evaluateAiQualityTestSetDeterministically({
      tenantId,
      workspaceId,
      assistantId,
      testSet: testSetFixture(),
      caseOutputs: [
        { testCaseId: testCaseIdA, candidateOutput },
        { testCaseId: testCaseIdB, candidateOutput: 'safe answer' },
      ],
      now,
    });

    expect(result.summary).toMatchObject({ totalCases: 2, passedCases: 2, scoreBasisPoints: 10000 });
    expect(result.results[0].candidateOutputHash).toBe(createHash('sha256').update(candidateOutput).digest('hex'));
    expect(result.results[0].candidateOutputExcerpt).not.toContain('TAIL_FULL_OUTPUT_SHOULD_NOT_PERSIST');
    expect(JSON.stringify(result.results)).not.toContain(candidateOutput);
    expect(result.results[0]).not.toHaveProperty('candidateOutput');
  });

  it('does not call fetch, LLM, provider, runtime, MCP or Agno dependencies', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    evaluateAiQualityTestSetDeterministically({
      tenantId,
      workspaceId,
      assistantId,
      testSet: testSetFixture(),
      caseOutputs: [
        { testCaseId: testCaseIdA, candidateOutput: 'quality' },
        { testCaseId: testCaseIdB, candidateOutput: 'safe answer' },
      ],
      now,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
