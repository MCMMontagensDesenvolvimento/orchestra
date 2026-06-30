import { sanitizeAiQualityMetadata, sanitizeAiQualityTextExcerpt } from './ai-quality.sanitizer';
import { aiQualityAssertionsSchema } from './ai-quality.schema';
import type {
  AiQualityEvaluationResultRecord,
  AiQualityEvaluationRunDetailRecord,
  AiQualityEvaluationRunListRecord,
  AiQualityTestCaseDetailRecord,
  AiQualityTestCaseListRecord,
  AiQualityTestSetDetailRecord,
  AiQualityTestSetListRecord,
} from './ai-quality.repository';
import type { AiQualityTestCaseEvaluation } from './ai-quality.types';

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function safeAssertions(value: unknown) {
  const parsed = aiQualityAssertionsSchema.safeParse(value);
  if (!parsed.success) return [];
  return parsed.data;
}

function mapTestSetBase(testSet: AiQualityTestSetListRecord) {
  return {
    id: testSet.id,
    workspaceId: testSet.workspaceId,
    assistantId: testSet.assistantId,
    name: testSet.name,
    description: testSet.description,
    status: testSet.status,
    createdByUserId: testSet.createdByUserId,
    updatedByUserId: testSet.updatedByUserId,
    createdAt: testSet.createdAt.toISOString(),
    updatedAt: testSet.updatedAt.toISOString(),
    deletedAt: iso(testSet.deletedAt),
  };
}

export function mapAiQualityTestSetList(testSet: AiQualityTestSetListRecord) {
  return mapTestSetBase(testSet);
}

export function mapAiQualityTestSetDetail(testSet: AiQualityTestSetDetailRecord) {
  return {
    ...mapTestSetBase(testSet),
    metadata: sanitizeAiQualityMetadata(testSet.metadata) ?? null,
  };
}

function mapTestCaseBase(testCase: AiQualityTestCaseListRecord) {
  return {
    id: testCase.id,
    testSetId: testCase.testSetId,
    assistantId: testCase.assistantId,
    name: testCase.name,
    description: testCase.description,
    tags: sanitizeAiQualityMetadata(testCase.tags) ?? null,
    status: testCase.status,
    sortOrder: testCase.sortOrder,
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
    deletedAt: iso(testCase.deletedAt),
  };
}

export function mapAiQualityTestCaseList(testCase: AiQualityTestCaseListRecord) {
  return mapTestCaseBase(testCase);
}

export function mapAiQualityTestCaseDetail(testCase: AiQualityTestCaseDetailRecord) {
  return {
    ...mapTestCaseBase(testCase),
    inputText: testCase.inputText,
    expectedOutput: testCase.expectedOutput,
    assertions: safeAssertions(testCase.assertions),
    metadata: sanitizeAiQualityMetadata(testCase.metadata) ?? null,
    testSet: {
      id: testCase.testSet.id,
      workspaceId: testCase.testSet.workspaceId,
      assistantId: testCase.testSet.assistantId,
      status: testCase.testSet.status,
      deletedAt: iso(testCase.testSet.deletedAt),
    },
  };
}

function mapEvaluationRunBase(run: AiQualityEvaluationRunListRecord) {
  return {
    id: run.id,
    workspaceId: run.workspaceId,
    assistantId: run.assistantId,
    testSetId: run.testSetId,
    status: run.status,
    mode: run.mode,
    startedAt: iso(run.startedAt),
    completedAt: iso(run.completedAt),
    totalCases: run.totalCases,
    passedCases: run.passedCases,
    failedCases: run.failedCases,
    warningCases: run.warningCases,
    errorCases: run.errorCases,
    skippedCases: run.skippedCases,
    scoreBasisPoints: run.scoreBasisPoints,
    createdByUserId: run.createdByUserId,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    deletedAt: iso(run.deletedAt),
  };
}

export function mapAiQualityEvaluationRunList(run: AiQualityEvaluationRunListRecord) {
  return mapEvaluationRunBase(run);
}

export function mapAiQualityEvaluationRunDetail(run: AiQualityEvaluationRunDetailRecord) {
  return {
    ...mapEvaluationRunBase(run),
    metadata: sanitizeAiQualityMetadata(run.metadata) ?? null,
  };
}

export function mapAiQualityEvaluationResult(result: AiQualityEvaluationResultRecord) {
  return {
    id: result.id,
    runId: result.runId,
    testCaseId: result.testCaseId,
    status: result.status,
    scoreBasisPoints: result.scoreBasisPoints,
    assertionResults: sanitizeAiQualityMetadata(result.assertionResults) ?? [],
    candidateOutputHash: result.candidateOutputHash,
    candidateOutputExcerpt: result.candidateOutputExcerpt
      ? sanitizeAiQualityTextExcerpt(result.candidateOutputExcerpt, 240)
      : null,
    errorCode: result.errorCode,
    errorMessageHash: result.errorMessageHash,
    metadata: sanitizeAiQualityMetadata(result.metadata) ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

export function mapAiQualityTestCaseEvaluation(evaluation: AiQualityTestCaseEvaluation) {
  return {
    status: evaluation.status,
    scoreBasisPoints: evaluation.scoreBasisPoints,
    assertionResults: evaluation.assertionResults,
    candidateOutputHash: evaluation.candidateOutputHash,
    candidateOutputExcerpt: evaluation.candidateOutputExcerpt,
    evaluatedAt: evaluation.evaluatedAt.toISOString(),
  };
}
