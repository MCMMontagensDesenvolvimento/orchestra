export const aiQualityLifecycleStatusValues = ['active', 'disabled', 'archived'] as const;
export type AiQualityLifecycleStatus = typeof aiQualityLifecycleStatusValues[number];

export const aiQualityEvaluationRunStatusValues = [
  'created',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type AiQualityEvaluationRunStatus = typeof aiQualityEvaluationRunStatusValues[number];

export const aiQualityEvaluationModeValues = ['manual_snapshot', 'deterministic'] as const;
export type AiQualityEvaluationMode = typeof aiQualityEvaluationModeValues[number];

export const aiQualityEvaluationResultStatusValues = [
  'passed',
  'failed',
  'warning',
  'error',
  'skipped',
] as const;
export type AiQualityEvaluationResultStatus = typeof aiQualityEvaluationResultStatusValues[number];

export const aiQualityAssertionTypeValues = [
  'contains_any',
  'contains_all',
  'not_contains_any',
  'min_length',
  'max_length',
  'regex_contains',
  'regex_not_contains',
  'json_valid',
] as const;
export type AiQualityAssertionType = typeof aiQualityAssertionTypeValues[number];

export const aiQualityAssertionSeverityValues = ['required', 'warning'] as const;
export type AiQualityAssertionSeverity = typeof aiQualityAssertionSeverityValues[number];

export interface AiQualityRequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AiQualityAssertionBase {
  type: AiQualityAssertionType;
  severity?: AiQualityAssertionSeverity;
}

export interface AiQualityContainsAssertion extends AiQualityAssertionBase {
  type: 'contains_any' | 'contains_all' | 'not_contains_any';
  values: string[];
  caseSensitive?: boolean;
}

export interface AiQualityLengthAssertion extends AiQualityAssertionBase {
  type: 'min_length' | 'max_length';
  value: number;
}

export interface AiQualityRegexAssertion extends AiQualityAssertionBase {
  type: 'regex_contains' | 'regex_not_contains';
  pattern: string;
  flags?: string;
}

export interface AiQualityJsonValidAssertion extends AiQualityAssertionBase {
  type: 'json_valid';
}

export type AiQualityAssertion =
  | AiQualityContainsAssertion
  | AiQualityLengthAssertion
  | AiQualityRegexAssertion
  | AiQualityJsonValidAssertion;

export interface AiQualityAssertionEvaluationResult {
  type: AiQualityAssertionType;
  passed: boolean;
  severity: AiQualityAssertionSeverity;
  reason: string;
  expected: unknown;
  actualSummary: string;
}

export interface EvaluateAiQualityTestCaseInput {
  tenantId: string;
  workspaceId?: string | null;
  assistantId?: string | null;
  testCaseId?: string | null;
  inputText?: string | null;
  candidateOutput: string;
  assertions: AiQualityAssertion[];
  now?: Date | null;
  metadata?: unknown;
}

export interface AiQualityTestCaseEvaluation {
  status: AiQualityEvaluationResultStatus;
  scoreBasisPoints: number;
  assertionResults: AiQualityAssertionEvaluationResult[];
  candidateOutputHash: string;
  candidateOutputExcerpt: string | null;
  evaluatedAt: Date;
}

export interface AiQualityRunSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  warningCases: number;
  errorCases: number;
  skippedCases: number;
  scoreBasisPoints: number | null;
}

export interface AiQualityAssistantSnapshotSummary {
  assistantId: string;
  name?: string;
  status?: string;
  workspaceId?: string;
  capturedAt: string;
}

export interface AiQualityTestSetSnapshotSummary {
  testSetId: string;
  name: string;
  status: string;
  workspaceId: string | null;
  assistantId: string | null;
  testCaseCount: number;
  activeTestCaseCount: number;
  capturedAt: string;
}
