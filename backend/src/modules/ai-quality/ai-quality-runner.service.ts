import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error';
import { evaluateAiQualityTestCase } from './ai-quality-evaluator.service';
import { sanitizeAiQualityMetadata, sha256Hex } from './ai-quality.sanitizer';
import type {
  AiQualityAssistantSnapshotRecord,
  AiQualityCreateEvaluationRunResultInput,
  AiQualityTestSetForRunRecord,
} from './ai-quality.repository';
import type {
  AiQualityAssistantSnapshotSummary,
  AiQualityRunSummary,
  AiQualityTestSetSnapshotSummary,
} from './ai-quality.types';

export interface AiQualityCaseOutputInput {
  testCaseId: string;
  candidateOutput: string;
  metadata?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;

  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    canonical[key] = canonicalize(value[key]);
  }
  return canonical;
}

export function canonicalizeAiQualitySnapshot(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function hashAiQualitySnapshot(value: unknown) {
  return sha256Hex(canonicalizeAiQualitySnapshot(value));
}

export function buildAiQualityRunSummary(
  results: Pick<AiQualityCreateEvaluationRunResultInput, 'status' | 'scoreBasisPoints'>[],
): AiQualityRunSummary {
  const summary: AiQualityRunSummary = {
    totalCases: results.length,
    passedCases: 0,
    failedCases: 0,
    warningCases: 0,
    errorCases: 0,
    skippedCases: 0,
    scoreBasisPoints: null,
  };

  let scoreSum = 0;
  let scoredResults = 0;
  for (const result of results) {
    if (result.status === 'passed') summary.passedCases += 1;
    if (result.status === 'failed') summary.failedCases += 1;
    if (result.status === 'warning') summary.warningCases += 1;
    if (result.status === 'error') summary.errorCases += 1;
    if (result.status === 'skipped') summary.skippedCases += 1;

    if (result.status !== 'skipped') {
      scoreSum += result.scoreBasisPoints;
      scoredResults += 1;
    }
  }

  summary.scoreBasisPoints = scoredResults > 0 ? Math.round(scoreSum / scoredResults) : null;
  return summary;
}

export function buildAiQualityAssistantSnapshot(
  assistant: AiQualityAssistantSnapshotRecord | null,
  capturedAt: Date,
) {
  if (!assistant) return { hash: null, summary: null };

  const summary: AiQualityAssistantSnapshotSummary = {
    assistantId: assistant.id,
    name: assistant.name,
    status: assistant.status,
    workspaceId: assistant.workspaceId,
    capturedAt: capturedAt.toISOString(),
  };
  const sanitized = sanitizeAiQualityMetadata(summary) as AiQualityAssistantSnapshotSummary;
  return {
    hash: hashAiQualitySnapshot(sanitized),
    summary: sanitized,
  };
}

export function buildAiQualityTestSetSnapshot(
  testSet: AiQualityTestSetForRunRecord,
  capturedAt: Date,
) {
  const summary: AiQualityTestSetSnapshotSummary = {
    testSetId: testSet.id,
    name: testSet.name,
    status: testSet.status,
    workspaceId: testSet.workspaceId,
    assistantId: testSet.assistantId,
    testCaseCount: testSet._count.testCases,
    activeTestCaseCount: testSet.testCases.length,
    capturedAt: capturedAt.toISOString(),
  };
  const sanitized = sanitizeAiQualityMetadata(summary) as AiQualityTestSetSnapshotSummary;
  return {
    hash: hashAiQualitySnapshot(sanitized),
    summary: sanitized,
  };
}

export function validateAiQualityCaseOutputs(
  testSet: AiQualityTestSetForRunRecord,
  caseOutputs: AiQualityCaseOutputInput[],
) {
  const expectedCaseIds = new Set(testSet.testCases.map((testCase) => testCase.id));
  const seenCaseIds = new Set<string>();
  const outputsByCaseId = new Map<string, AiQualityCaseOutputInput>();

  for (const output of caseOutputs) {
    if (seenCaseIds.has(output.testCaseId)) {
      throw new AppError(422, 'AI_QUALITY_CASE_OUTPUT_DUPLICATED', 'caseOutputs contem testCaseId duplicado.');
    }
    seenCaseIds.add(output.testCaseId);

    if (!expectedCaseIds.has(output.testCaseId)) {
      throw new AppError(422, 'AI_QUALITY_CASE_OUTPUT_OUT_OF_TEST_SET', 'caseOutputs contem testCase fora do test set ativo.');
    }
    outputsByCaseId.set(output.testCaseId, output);
  }

  const missing = testSet.testCases.filter((testCase) => !outputsByCaseId.has(testCase.id));
  if (missing.length > 0) {
    throw new AppError(422, 'AI_QUALITY_CASE_OUTPUT_MISSING', 'Todos os test cases ativos precisam de candidateOutput explicito.');
  }

  return outputsByCaseId;
}

export function evaluateAiQualityTestSetDeterministically(input: {
  tenantId: string;
  workspaceId?: string | null;
  assistantId?: string | null;
  testSet: AiQualityTestSetForRunRecord;
  caseOutputs: AiQualityCaseOutputInput[];
  now: Date;
}) {
  const outputsByCaseId = validateAiQualityCaseOutputs(input.testSet, input.caseOutputs);
  const results: AiQualityCreateEvaluationRunResultInput[] = input.testSet.testCases.map((testCase) => {
    const caseOutput = outputsByCaseId.get(testCase.id)!;
    try {
      const evaluation = evaluateAiQualityTestCase({
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: testCase.assistantId ?? input.assistantId,
        testCaseId: testCase.id,
        inputText: testCase.inputText,
        candidateOutput: caseOutput.candidateOutput,
        assertions: testCase.assertions as any,
        now: input.now,
        metadata: caseOutput.metadata,
      });

      return {
        testCaseId: testCase.id,
        status: evaluation.status,
        scoreBasisPoints: evaluation.scoreBasisPoints,
        assertionResults: evaluation.assertionResults,
        candidateOutputHash: evaluation.candidateOutputHash,
        candidateOutputExcerpt: evaluation.candidateOutputExcerpt,
        metadata: sanitizeAiQualityMetadata(caseOutput.metadata),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof ZodError) {
        throw new AppError(422, 'AI_QUALITY_TEST_CASE_ASSERTIONS_INVALID', 'Assertions do test case sao invalidas.');
      }
      throw error;
    }
  });

  return {
    results,
    summary: buildAiQualityRunSummary(results),
  };
}
