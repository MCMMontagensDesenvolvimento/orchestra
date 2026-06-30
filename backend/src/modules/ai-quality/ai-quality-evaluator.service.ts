import { AppError } from '../../shared/errors/app-error';
import {
  sanitizeAiQualityTextExcerpt,
  sha256Hex,
} from './ai-quality.sanitizer';
import { aiQualityAssertionsSchema } from './ai-quality.schema';
import type {
  AiQualityAssertion,
  AiQualityAssertionEvaluationResult,
  AiQualityAssertionSeverity,
  AiQualityTestCaseEvaluation,
  EvaluateAiQualityTestCaseInput,
} from './ai-quality.types';

const maxCandidateOutputChars = 16000;
const maxRegexTargetChars = 10000;

function severity(assertion: AiQualityAssertion): AiQualityAssertionSeverity {
  return assertion.severity ?? 'required';
}

function compareText(value: string, caseSensitive: boolean | undefined) {
  return caseSensitive ? value : value.toLowerCase();
}

function sanitizeTerms(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function result(
  assertion: AiQualityAssertion,
  passed: boolean,
  reason: string,
  expected: unknown,
  actualSummary: string,
): AiQualityAssertionEvaluationResult {
  return {
    type: assertion.type,
    passed,
    severity: severity(assertion),
    reason,
    expected,
    actualSummary: sanitizeAiQualityTextExcerpt(actualSummary, 160) ?? 'unavailable',
  };
}

function isSafeRegexPattern(pattern: string) {
  if (pattern.length > 200) return false;
  if (/[^\S\r\n]{80,}/.test(pattern)) return false;
  if (/\(\?<?[=!]/.test(pattern)) return false;
  if (/\\[1-9]/.test(pattern)) return false;
  if (/\([^)]*[+*][^)]*\)[+*?{]/.test(pattern)) return false;
  if (/(\.\*){2,}/.test(pattern)) return false;
  return true;
}

function evaluateContains(assertion: Extract<AiQualityAssertion, { type: 'contains_any' | 'contains_all' | 'not_contains_any' }>, candidateOutput: string) {
  const terms = sanitizeTerms(assertion.values);
  const haystack = compareText(candidateOutput, assertion.caseSensitive);
  const normalizedTerms = terms.map((term) => compareText(term, assertion.caseSensitive));
  const matchCount = normalizedTerms.filter((term) => haystack.includes(term)).length;

  if (assertion.type === 'contains_any') {
    return result(
      assertion,
      matchCount > 0,
      matchCount > 0 ? 'at_least_one_expected_term_found' : 'no_expected_terms_found',
      { values: terms },
      `matchedTerms=${matchCount}`,
    );
  }

  if (assertion.type === 'contains_all') {
    return result(
      assertion,
      matchCount === normalizedTerms.length,
      matchCount === normalizedTerms.length ? 'all_expected_terms_found' : 'missing_expected_terms',
      { values: terms },
      `matchedTerms=${matchCount}; expectedTerms=${normalizedTerms.length}`,
    );
  }

  return result(
    assertion,
    matchCount === 0,
    matchCount === 0 ? 'forbidden_terms_absent' : 'forbidden_term_found',
    { forbiddenCount: terms.length },
    `forbiddenMatches=${matchCount}`,
  );
}

function evaluateLength(assertion: Extract<AiQualityAssertion, { type: 'min_length' | 'max_length' }>, candidateOutput: string) {
  const actualLength = candidateOutput.length;
  if (assertion.type === 'min_length') {
    return result(
      assertion,
      actualLength >= assertion.value,
      actualLength >= assertion.value ? 'min_length_satisfied' : 'min_length_not_met',
      { minLength: assertion.value },
      `length=${actualLength}`,
    );
  }

  return result(
    assertion,
    actualLength <= assertion.value,
    actualLength <= assertion.value ? 'max_length_satisfied' : 'max_length_exceeded',
    { maxLength: assertion.value },
    `length=${actualLength}`,
  );
}

function evaluateRegex(assertion: Extract<AiQualityAssertion, { type: 'regex_contains' | 'regex_not_contains' }>, candidateOutput: string) {
  if (!isSafeRegexPattern(assertion.pattern)) {
    return result(
      assertion,
      false,
      'unsafe_regex_pattern',
      { patternLength: assertion.pattern.length },
      'regexNotExecuted=true',
    );
  }

  try {
    const regex = new RegExp(assertion.pattern, assertion.flags ?? '');
    const matched = regex.test(candidateOutput.slice(0, maxRegexTargetChars));
    if (assertion.type === 'regex_contains') {
      return result(
        assertion,
        matched,
        matched ? 'regex_match_found' : 'regex_match_not_found',
        { patternLength: assertion.pattern.length, flags: assertion.flags ?? '' },
        `matched=${matched}`,
      );
    }

    return result(
      assertion,
      !matched,
      matched ? 'forbidden_regex_match_found' : 'forbidden_regex_absent',
      { patternLength: assertion.pattern.length, flags: assertion.flags ?? '' },
      `matched=${matched}`,
    );
  } catch {
    return result(
      assertion,
      false,
      'invalid_regex_pattern',
      { patternLength: assertion.pattern.length },
      'regexNotExecuted=true',
    );
  }
}

function evaluateJsonValid(assertion: Extract<AiQualityAssertion, { type: 'json_valid' }>, candidateOutput: string) {
  try {
    JSON.parse(candidateOutput);
    return result(assertion, true, 'json_valid', { json: true }, 'jsonValid=true');
  } catch {
    return result(assertion, false, 'json_invalid', { json: true }, 'jsonValid=false');
  }
}

function evaluateAssertion(assertion: AiQualityAssertion, candidateOutput: string) {
  switch (assertion.type) {
    case 'contains_any':
    case 'contains_all':
    case 'not_contains_any':
      return evaluateContains(assertion, candidateOutput);
    case 'min_length':
    case 'max_length':
      return evaluateLength(assertion, candidateOutput);
    case 'regex_contains':
    case 'regex_not_contains':
      return evaluateRegex(assertion, candidateOutput);
    case 'json_valid':
      return evaluateJsonValid(assertion, candidateOutput);
    default:
      return result(assertion, false, 'unsupported_assertion', {}, 'unsupported=true');
  }
}

export function evaluateAiQualityTestCase(input: EvaluateAiQualityTestCaseInput): AiQualityTestCaseEvaluation {
  if (input.candidateOutput.length > maxCandidateOutputChars) {
    throw new AppError(422, 'AI_QUALITY_CANDIDATE_OUTPUT_TOO_LARGE', 'candidateOutput excede o tamanho permitido.');
  }

  const assertions = aiQualityAssertionsSchema.parse(input.assertions);
  const assertionResults = assertions.map((assertion) => evaluateAssertion(assertion, input.candidateOutput));
  const passedAssertions = assertionResults.filter((assertion) => assertion.passed).length;
  const scoreBasisPoints = Math.round((passedAssertions * 10000) / assertionResults.length);
  const requiredFailed = assertionResults.some((assertion) => !assertion.passed && assertion.severity === 'required');
  const warningFailed = assertionResults.some((assertion) => !assertion.passed && assertion.severity === 'warning');
  const status = requiredFailed ? 'failed' : warningFailed ? 'warning' : 'passed';

  return {
    status,
    scoreBasisPoints,
    assertionResults,
    candidateOutputHash: sha256Hex(input.candidateOutput),
    candidateOutputExcerpt: sanitizeAiQualityTextExcerpt(input.candidateOutput),
    evaluatedAt: input.now ?? new Date(),
  };
}
