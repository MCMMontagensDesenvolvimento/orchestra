import { z } from 'zod';
import {
  aiUsageEventSourceValues,
  aiUsageEventStatusValues,
} from './ai-observability.types';
import {
  aiUsageLimitMetricValues,
  aiUsageLimitModeValues,
  aiUsageLimitPeriodValues,
  aiUsageLimitPolicyStatusValues,
  aiUsageLimitScopeValues,
} from './ai-usage-limits.types';

const nullableFilter = (max: number) => z.string().trim().min(1).max(max).optional();
const optionalUuid = z.string().uuid().optional();
const dateRange = {
  startedAtFrom: z.coerce.date().optional(),
  startedAtTo: z.coerce.date().optional(),
};
const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
};
const booleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());
const projectedValue = z.union([
  z.number().int().nonnegative().safe(),
  z.string().trim().regex(/^\d+$/).max(30),
]);

export const aiUsageEventsQuerySchema = z.object({
  ...pageFields,
  workspaceId: optionalUuid,
  assistantId: optionalUuid,
  userId: optionalUuid,
  runId: nullableFilter(160),
  traceId: nullableFilter(160),
  source: z.enum(aiUsageEventSourceValues).optional(),
  operation: nullableFilter(80),
  provider: nullableFilter(80),
  model: nullableFilter(160),
  status: z.enum(aiUsageEventStatusValues).optional(),
  ...dateRange,
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
  sort: z.enum([
    'startedAt:desc',
    'startedAt:asc',
    'createdAt:desc',
    'createdAt:asc',
  ]).default('startedAt:desc'),
}).strict();

export const aiUsageSummaryGroupByValues = [
  'none',
  'workspace',
  'assistant',
  'user',
  'source',
  'operation',
  'provider',
  'model',
  'status',
  'day',
  'month',
] as const;

export const aiUsageSummaryQuerySchema = z.object({
  workspaceId: optionalUuid,
  assistantId: optionalUuid,
  userId: optionalUuid,
  source: z.enum(aiUsageEventSourceValues).optional(),
  operation: nullableFilter(80),
  provider: nullableFilter(80),
  model: nullableFilter(160),
  status: z.enum(aiUsageEventStatusValues).optional(),
  ...dateRange,
  groupBy: z.enum(aiUsageSummaryGroupByValues).default('none'),
}).strict();

export const aiUsageLimitPoliciesQuerySchema = z.object({
  ...pageFields,
  workspaceId: optionalUuid,
  assistantId: optionalUuid,
  userId: optionalUuid,
  scopeType: z.enum(aiUsageLimitScopeValues).optional(),
  metric: z.enum(aiUsageLimitMetricValues).optional(),
  period: z.enum(aiUsageLimitPeriodValues).optional(),
  mode: z.enum(aiUsageLimitModeValues).optional(),
  status: z.enum(aiUsageLimitPolicyStatusValues).optional(),
  source: nullableFilter(40),
  operation: nullableFilter(80),
  provider: nullableFilter(80),
  model: nullableFilter(160),
  includeDeleted: booleanQuery.default(false),
  sort: z.enum([
    'createdAt:desc',
    'createdAt:asc',
    'updatedAt:desc',
    'updatedAt:asc',
  ]).default('createdAt:desc'),
}).strict();

export const aiUsageLimitEvaluationSchema = z.object({
  workspaceId: z.string().uuid(),
  assistantId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  source: z.enum(aiUsageEventSourceValues).nullable().optional(),
  operation: z.string().trim().min(1).max(80).nullable().optional(),
  provider: z.string().trim().min(1).max(80).nullable().optional(),
  model: z.string().trim().min(1).max(160).nullable().optional(),
  now: z.coerce.date().optional(),
  projectedUsage: z.object({
    runCount: projectedValue.nullable().optional(),
    inputTokens: projectedValue.nullable().optional(),
    outputTokens: projectedValue.nullable().optional(),
    totalTokens: projectedValue.nullable().optional(),
    embeddingTokens: projectedValue.nullable().optional(),
    cachedTokens: projectedValue.nullable().optional(),
    estimatedCostMinorUnits: projectedValue.nullable().optional(),
    failedRunCount: projectedValue.nullable().optional(),
    blockedRunCount: projectedValue.nullable().optional(),
  }).strict().nullable().optional(),
}).strict();

export type AiUsageEventsQuery = z.infer<typeof aiUsageEventsQuerySchema>;
export type AiUsageSummaryQuery = z.infer<typeof aiUsageSummaryQuerySchema>;
export type AiUsageSummaryGroupBy = typeof aiUsageSummaryGroupByValues[number];
export type AiUsageLimitPoliciesQuery = z.infer<typeof aiUsageLimitPoliciesQuerySchema>;
export type AiUsageLimitEvaluationBody = z.infer<typeof aiUsageLimitEvaluationSchema>;
