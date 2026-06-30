import { z } from 'zod';
import { approximateJsonSize, hasUnsafeAiQualityMetadata } from './ai-quality.sanitizer';
import {
  aiQualityAssertionSeverityValues,
  aiQualityEvaluationModeValues,
  aiQualityEvaluationResultStatusValues,
  aiQualityEvaluationRunStatusValues,
  aiQualityLifecycleStatusValues,
} from './ai-quality.types';

const optionalUuid = z.string().uuid().optional();
const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
};
const booleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string().max(500),
  z.array(jsonValueSchema).max(25),
  z.record(jsonValueSchema),
]));

export const aiQualitySafeMetadataSchema = jsonValueSchema
  .refine((value) => approximateJsonSize(value) <= 4000, 'metadata excede o tamanho permitido.')
  .refine((value) => !hasUnsafeAiQualityMetadata(value), 'metadata contem campos ou valores sensiveis.');

const severitySchema = z.enum(aiQualityAssertionSeverityValues).default('required');
const assertionValuesSchema = z.array(z.string().trim().min(1).max(120)).min(1).max(20);
const regexFlagsSchema = z.string()
  .trim()
  .max(3)
  .regex(/^[imu]*$/)
  .refine((value) => new Set(value.split('')).size === value.length, 'flags de regex duplicadas nao sao permitidas.')
  .optional();

export const aiQualityAssertionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('contains_any'),
    values: assertionValuesSchema,
    severity: severitySchema,
    caseSensitive: z.boolean().default(false),
  }).strict(),
  z.object({
    type: z.literal('contains_all'),
    values: assertionValuesSchema,
    severity: severitySchema,
    caseSensitive: z.boolean().default(false),
  }).strict(),
  z.object({
    type: z.literal('not_contains_any'),
    values: assertionValuesSchema,
    severity: severitySchema,
    caseSensitive: z.boolean().default(false),
  }).strict(),
  z.object({
    type: z.literal('min_length'),
    value: z.number().int().min(0).max(16000),
    severity: severitySchema,
  }).strict(),
  z.object({
    type: z.literal('max_length'),
    value: z.number().int().min(0).max(16000),
    severity: severitySchema,
  }).strict(),
  z.object({
    type: z.literal('regex_contains'),
    pattern: z.string().trim().min(1).max(200),
    flags: regexFlagsSchema,
    severity: severitySchema,
  }).strict(),
  z.object({
    type: z.literal('regex_not_contains'),
    pattern: z.string().trim().min(1).max(200),
    flags: regexFlagsSchema,
    severity: severitySchema,
  }).strict(),
  z.object({
    type: z.literal('json_valid'),
    severity: severitySchema,
  }).strict(),
]);

export const aiQualityAssertionsSchema = z.array(aiQualityAssertionSchema).min(1).max(50);

const nullableUuid = z.string().uuid().nullable();
const nameSchema = z.string().trim().min(1).max(160);
const descriptionSchema = z.string().trim().max(2000).nullable();
const tagsSchema = z.array(z.string().trim().min(1).max(80)).max(25)
  .refine((tags) => new Set(tags).size === tags.length, 'tags duplicadas nao sao permitidas.');

export const aiQualityCreateTestSetSchema = z.object({
  workspaceId: nullableUuid.optional(),
  assistantId: nullableUuid.optional(),
  name: nameSchema,
  description: descriptionSchema.optional(),
  status: z.enum(aiQualityLifecycleStatusValues).default('active'),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
}).strict();

export const aiQualityUpdateTestSetSchema = z.object({
  workspaceId: nullableUuid.optional(),
  assistantId: nullableUuid.optional(),
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  status: z.enum(aiQualityLifecycleStatusValues).optional(),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado.');

export const aiQualityCreateTestCaseSchema = z.object({
  testSetId: z.string().uuid(),
  assistantId: nullableUuid.optional(),
  name: nameSchema,
  description: descriptionSchema.optional(),
  inputText: z.string().trim().min(1).max(8000),
  expectedOutput: z.string().max(8000).nullable().optional(),
  assertions: aiQualityAssertionsSchema,
  tags: tagsSchema.nullable().optional(),
  status: z.enum(aiQualityLifecycleStatusValues).default('active'),
  sortOrder: z.number().int().min(0).max(1_000_000).default(0),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
}).strict();

export const aiQualityUpdateTestCaseSchema = z.object({
  assistantId: nullableUuid.optional(),
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  inputText: z.string().trim().min(1).max(8000).optional(),
  expectedOutput: z.string().max(8000).nullable().optional(),
  assertions: aiQualityAssertionsSchema.optional(),
  tags: tagsSchema.nullable().optional(),
  status: z.enum(aiQualityLifecycleStatusValues).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado.');

export const aiQualityTestSetsQuerySchema = z.object({
  ...pageFields,
  workspaceId: optionalUuid,
  assistantId: optionalUuid,
  status: z.enum(aiQualityLifecycleStatusValues).optional(),
  includeDeleted: booleanQuery.default(false),
  sort: z.enum([
    'createdAt:desc',
    'createdAt:asc',
    'updatedAt:desc',
    'updatedAt:asc',
    'name:asc',
    'name:desc',
  ]).default('createdAt:desc'),
}).strict();

export const aiQualityTestCasesQuerySchema = z.object({
  ...pageFields,
  workspaceId: optionalUuid,
  testSetId: optionalUuid,
  assistantId: optionalUuid,
  status: z.enum(aiQualityLifecycleStatusValues).optional(),
  includeDeleted: booleanQuery.default(false),
  sort: z.enum([
    'sortOrder:asc',
    'sortOrder:desc',
    'createdAt:desc',
    'createdAt:asc',
    'updatedAt:desc',
    'updatedAt:asc',
  ]).default('sortOrder:asc'),
}).strict();

export const aiQualityEvaluationRunsQuerySchema = z.object({
  ...pageFields,
  workspaceId: optionalUuid,
  assistantId: optionalUuid,
  testSetId: optionalUuid,
  status: z.enum(aiQualityEvaluationRunStatusValues).optional(),
  mode: z.enum(aiQualityEvaluationModeValues).optional(),
  includeDeleted: booleanQuery.default(false),
  sort: z.enum([
    'createdAt:desc',
    'createdAt:asc',
    'updatedAt:desc',
    'updatedAt:asc',
    'startedAt:desc',
    'startedAt:asc',
  ]).default('createdAt:desc'),
}).strict();

export const aiQualityEvaluationResultsQuerySchema = z.object({
  ...pageFields,
  workspaceId: optionalUuid,
  runId: optionalUuid,
  testCaseId: optionalUuid,
  status: z.enum(aiQualityEvaluationResultStatusValues).optional(),
  sort: z.enum([
    'createdAt:desc',
    'createdAt:asc',
    'updatedAt:desc',
    'updatedAt:asc',
  ]).default('createdAt:desc'),
}).strict();

export const aiQualityEvaluationRunResultsQuerySchema = z.object({
  ...pageFields,
  status: z.enum(aiQualityEvaluationResultStatusValues).optional(),
  sort: z.enum([
    'createdAt:desc',
    'createdAt:asc',
    'updatedAt:desc',
    'updatedAt:asc',
  ]).default('createdAt:desc'),
}).strict();

export const aiQualityEvaluateTestCaseSchema = z.object({
  workspaceId: optionalUuid,
  assistantId: z.string().uuid().nullable().optional(),
  testCaseId: z.string().uuid().nullable().optional(),
  inputText: z.string().trim().max(8000).nullable().optional(),
  candidateOutput: z.string().max(16000),
  assertions: aiQualityAssertionsSchema.optional(),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.testCaseId && !value.assertions) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assertions'],
      message: 'assertions e obrigatorio quando testCaseId nao e informado.',
    });
  }
});

const aiQualityCaseOutputSchema = z.object({
  testCaseId: z.string().uuid(),
  candidateOutput: z.string().max(16000),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
}).strict();

export const aiQualityCreateDeterministicRunSchema = z.object({
  workspaceId: optionalUuid,
  assistantId: z.string().uuid().nullable().optional(),
  testSetId: z.string().uuid(),
  mode: z.literal('deterministic').default('deterministic'),
  metadata: aiQualitySafeMetadataSchema.nullable().optional(),
  caseOutputs: z.array(aiQualityCaseOutputSchema).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  value.caseOutputs.forEach((caseOutput, index) => {
    if (seen.has(caseOutput.testCaseId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['caseOutputs', index, 'testCaseId'],
        message: 'testCaseId duplicado em caseOutputs.',
      });
    }
    seen.add(caseOutput.testCaseId);
  });
});

export type AiQualityTestSetsQuery = z.infer<typeof aiQualityTestSetsQuerySchema>;
export type AiQualityTestCasesQuery = z.infer<typeof aiQualityTestCasesQuerySchema>;
export type AiQualityEvaluationRunsQuery = z.infer<typeof aiQualityEvaluationRunsQuerySchema>;
export type AiQualityEvaluationResultsQuery = z.infer<typeof aiQualityEvaluationResultsQuerySchema>;
export type AiQualityEvaluationRunResultsQuery = z.infer<typeof aiQualityEvaluationRunResultsQuerySchema>;
export type AiQualityEvaluateTestCaseBody = z.infer<typeof aiQualityEvaluateTestCaseSchema>;
export type AiQualityCreateDeterministicRunBody = z.infer<typeof aiQualityCreateDeterministicRunSchema>;
export type AiQualityCreateTestSetBody = z.infer<typeof aiQualityCreateTestSetSchema>;
export type AiQualityUpdateTestSetBody = z.infer<typeof aiQualityUpdateTestSetSchema>;
export type AiQualityCreateTestCaseBody = z.infer<typeof aiQualityCreateTestCaseSchema>;
export type AiQualityUpdateTestCaseBody = z.infer<typeof aiQualityUpdateTestCaseSchema>;
