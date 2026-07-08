import { z } from 'zod';

export const assistantRuntimeSpecVersionV1 = 'orchestra.runtime.assistant.v1' as const;
export const runtimeExecuteRequestSpecVersionV1 = 'orchestra.runtime.execute.v1' as const;
export const runtimeExecuteResponseSpecVersionV1 = 'orchestra.runtime.response.v1' as const;

export const runtimeContractRagModeValues = ['none', 'resolved_context', 'gateway'] as const;
export const runtimeContractToolModeValues = ['none', 'gateway'] as const;
export const runtimeContractToolRiskLevelValues = ['low', 'medium', 'high'] as const;
export const runtimeContractOutputFormatValues = ['text', 'json'] as const;
export const runtimeContractResponseStatusValues = ['succeeded', 'failed', 'blocked', 'cancelled'] as const;
export const runtimeContractEventTypeValues = [
  'run.started',
  'model.requested',
  'model.completed',
  'rag.context.attached',
  'tool.descriptors.attached',
  'tool.requested',
  'tool.completed',
  'tool.blocked',
  'run.completed',
  'run.failed',
] as const;
export const runtimeContractEventStatusValues = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'blocked',
  'cancelled',
  'completed',
] as const;
export const runtimeContractErrorCodeValues = [
  'RUNTIME_UNAVAILABLE',
  'RUNTIME_TIMEOUT',
  'RUNTIME_BAD_REQUEST',
  'RUNTIME_POLICY_BLOCKED',
  'RUNTIME_TOOL_BLOCKED',
  'RUNTIME_RAG_BLOCKED',
  'RUNTIME_PROVIDER_FAILED',
  'RUNTIME_INVALID_RESPONSE',
  'RUNTIME_UNKNOWN_ERROR',
] as const;
export const runtimeContractHealthStatusValues = [
  'healthy',
  'degraded',
  'disabled',
  'misconfigured',
  'unavailable',
] as const;

const unsafeContractKeyFragments = new Set([
  'apikey',
  'authorization',
  'baseurl',
  'cookie',
  'credential',
  'connectionstring',
  'endpoint',
  'headers',
  'password',
  'providerapikey',
  'rawdocuments',
  'rawmcpserverconfig',
  'rawprompt',
  'rawproviderresponse',
  'rawresponse',
  'rawtoolmanifest',
  'secret',
  'secretref',
  'token',
]);

const allowedRuntimeContractTokenMetricKeys = new Set([
  'maxtokens',
  'inputtokens',
  'outputtokens',
  'totaltokens',
]);

const sensitiveStringPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;
const maxJsonDepth = 8;
const maxJsonStringChars = 2000;
const maxJsonArrayItems = 50;
const maxJsonObjectKeys = 80;
const maxMetadataBytes = 8000;

type RuntimeContractJsonValue =
  | null
  | boolean
  | number
  | string
  | RuntimeContractJsonValue[]
  | { [key: string]: RuntimeContractJsonValue };

function normalizedKey(key: string) {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function hasUnsafeContractKey(key: string) {
  const normalized = normalizedKey(key);

  if (allowedRuntimeContractTokenMetricKeys.has(normalized)) return false;

  return [...unsafeContractKeyFragments].some((fragment) => normalized.includes(fragment));
}

export function containsUnsafeRuntimeContractPayload(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return sensitiveStringPattern.test(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return true;
  if (depth > maxJsonDepth) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafeRuntimeContractPayload(item, depth + 1));
  if (typeof value !== 'object') return true;

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => (
    hasUnsafeContractKey(key) || containsUnsafeRuntimeContractPayload(entry, depth + 1)
  ));
}

function approximateJsonSize(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function safeJsonValueSchema(): z.ZodType<RuntimeContractJsonValue> {
  const schema: z.ZodType<RuntimeContractJsonValue> = z.lazy(() => z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string().max(maxJsonStringChars),
    z.array(schema).max(maxJsonArrayItems),
    z.record(schema).refine((value) => Object.keys(value).length <= maxJsonObjectKeys, 'objeto excede limite de chaves.'),
  ]));
  return schema;
}

const runtimeContractJsonSchema = safeJsonValueSchema();
const runtimeContractSafeObjectSchema = z.record(runtimeContractJsonSchema)
  .refine((value) => approximateJsonSize(value) <= maxMetadataBytes, 'metadata excede tamanho permitido.')
  .refine((value) => !containsUnsafeRuntimeContractPayload(value), 'payload contem campos ou valores sensiveis.');

const idSchema = z.string().trim().min(1).max(160);
const optionalIdArraySchema = z.array(idSchema).max(80).optional();
const textSchema = (maxChars: number) => z.string().trim().min(1).max(maxChars);
const optionalTextSchema = (maxChars: number) => z.string().trim().max(maxChars).optional();

export const runtimeInputAttachmentSchema = z.object({
  attachmentId: idSchema,
  type: z.enum(['file', 'image', 'text']),
  name: optionalTextSchema(240),
  mimeType: optionalTextSchema(120),
  sizeBytes: z.number().int().nonnegative().max(25_000_000).optional(),
  metadata: runtimeContractSafeObjectSchema.optional(),
}).strict();

export const runtimeConversationContextMessageSchema = z.object({
  messageId: idSchema,
  role: z.enum(['user', 'assistant']),
  content: textSchema(4000),
  createdAt: z.string().datetime(),
}).strict();

export const runtimeConversationContextSchema = z.object({
  messages: z.array(runtimeConversationContextMessageSchema).max(50),
  summary: z.object({
    enabled: z.literal(true),
    included: z.literal(true),
    messageCount: z.number().int().positive().max(50),
    totalChars: z.number().int().positive().max(20000),
    truncated: z.boolean(),
    maxMessages: z.number().int().positive().max(50),
    maxMessageChars: z.number().int().positive().max(4000),
    maxTotalChars: z.number().int().positive().max(20000),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const totalChars = value.messages.reduce((sum, message) => sum + message.content.length, 0);

  if (value.messages.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['messages'], message: 'contexto conversacional incluido exige mensagens.' });
  }
  if (value.messages.length !== value.summary.messageCount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['summary', 'messageCount'], message: 'messageCount diverge das mensagens.' });
  }
  if (value.messages.length > value.summary.maxMessages) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['messages'], message: 'mensagens excedem maxMessages.' });
  }
  if (totalChars !== value.summary.totalChars) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['summary', 'totalChars'], message: 'totalChars diverge das mensagens.' });
  }
  if (totalChars > value.summary.maxTotalChars) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['summary', 'maxTotalChars'], message: 'contexto excede maxTotalChars.' });
  }
  if (value.messages.some((message) => message.content.length > value.summary.maxMessageChars)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['messages'], message: 'mensagem excede maxMessageChars.' });
  }
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contexto conversacional contem campos ou valores sensiveis.' });
  }
});

export const runtimeRagSourceSchema = z.object({
  sourceId: idSchema,
  documentId: idSchema.optional(),
  chunkId: idSchema.optional(),
  title: optionalTextSchema(240),
  excerpt: textSchema(4000),
  score: z.number().min(0).max(1).optional(),
  metadata: runtimeContractSafeObjectSchema.optional(),
}).strict();

export const runtimeToolDescriptorSchema = z.object({
  toolId: idSchema,
  name: textSchema(120),
  description: optionalTextSchema(1000),
  riskLevel: z.enum(runtimeContractToolRiskLevelValues).default('medium'),
  approvalRequired: z.boolean(),
  inputSchema: runtimeContractSafeObjectSchema.optional(),
  metadata: runtimeContractSafeObjectSchema.optional(),
  gatewayRef: z.object({
    type: z.literal('orchestra_tool_gateway'),
    action: textSchema(160),
  }).strict().optional(),
}).strict();

export const runtimeNormalizedEventV1Schema = z.object({
  eventId: idSchema,
  traceId: idSchema,
  runId: idSchema,
  type: z.enum(runtimeContractEventTypeValues),
  timestamp: z.string().datetime(),
  status: z.enum(runtimeContractEventStatusValues),
  message: optionalTextSchema(1000),
  metadata: runtimeContractSafeObjectSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'evento contem campos ou valores sensiveis.' });
  }
});

export const runtimeNormalizedErrorV1Schema = z.object({
  code: z.enum(runtimeContractErrorCodeValues),
  message: textSchema(1000),
  retryable: z.boolean(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  details: runtimeContractSafeObjectSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'erro contem campos ou valores sensiveis.' });
  }
});

export const assistantRuntimeSpecV1Schema = z.object({
  specVersion: z.literal(assistantRuntimeSpecVersionV1),
  trace: z.object({
    traceId: idSchema,
    runId: idSchema,
    requestId: idSchema.optional(),
  }).strict(),
  tenant: z.object({
    id: idSchema,
  }).strict(),
  workspace: z.object({
    id: idSchema.nullable(),
  }).strict(),
  actor: z.object({
    userId: idSchema,
    roleIds: optionalIdArraySchema,
    permissionHints: optionalIdArraySchema,
  }).strict(),
  assistant: z.object({
    id: idSchema,
    versionId: idSchema.nullable().optional(),
    name: optionalTextSchema(240),
    status: optionalTextSchema(80),
    locale: z.string().trim().min(2).max(20).nullable().optional(),
  }).strict(),
  input: z.object({
    message: textSchema(16000),
    attachments: z.array(runtimeInputAttachmentSchema).max(20).optional(),
    metadata: runtimeContractSafeObjectSchema.optional(),
  }).strict(),
  conversationContext: runtimeConversationContextSchema.optional(),
  model: z.object({
    provider: textSchema(80),
    model: textSchema(160),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().max(200000).optional(),
    topP: z.number().min(0).max(1).optional(),
  }).strict(),
  policy: z.object({
    executionMode: z.literal('sync'),
    streaming: z.literal(false),
    timeoutMs: z.number().int().positive().max(300000),
    maxToolCalls: z.number().int().min(0).max(50),
    maxRagResults: z.number().int().min(0).max(100),
    maxContextChars: z.number().int().min(0).max(200000),
    failClosed: z.literal(true),
  }).strict(),
  instructions: z.object({
    system: optionalTextSchema(12000),
    developer: optionalTextSchema(12000),
    responseFormat: optionalTextSchema(120),
  }).strict(),
  rag: z.object({
    enabled: z.boolean(),
    mode: z.enum(runtimeContractRagModeValues),
    sources: z.array(runtimeRagSourceSchema).max(100),
  }).strict(),
  tools: z.object({
    enabled: z.boolean(),
    mode: z.enum(runtimeContractToolModeValues),
    descriptors: z.array(runtimeToolDescriptorSchema).max(50),
  }).strict(),
  observability: z.object({
    usageEventEnabled: z.boolean(),
    auditEnabled: z.boolean(),
    qualityEvaluationEnabled: z.boolean(),
  }).strict(),
  limits: z.object({
    enforce: z.boolean(),
    limitEvaluationId: idSchema.optional(),
    blockedBeforeRuntime: z.boolean().optional(),
  }).strict(),
  metadata: runtimeContractSafeObjectSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'spec contem campos ou valores sensiveis.' });
  }
  if (value.rag.mode === 'none' && value.rag.sources.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rag', 'sources'], message: 'RAG none nao aceita sources.' });
  }
  if (!value.rag.enabled && value.rag.mode !== 'none') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rag', 'mode'], message: 'RAG desabilitado exige mode none.' });
  }
  if (value.rag.mode === 'resolved_context' && value.rag.sources.length > value.policy.maxRagResults) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rag', 'sources'], message: 'sources excedem maxRagResults.' });
  }
  if (value.tools.mode === 'none' && value.tools.descriptors.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tools', 'descriptors'], message: 'tools none nao aceita descriptors.' });
  }
  if (!value.tools.enabled && value.tools.mode !== 'none') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tools', 'mode'], message: 'tools desabilitadas exigem mode none.' });
  }
});

export const runtimeExecuteRequestV1Schema = z.object({
  specVersion: z.literal(runtimeExecuteRequestSpecVersionV1),
  assistantRuntimeSpec: assistantRuntimeSpecV1Schema,
}).strict().superRefine((value, ctx) => {
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'request contem campos ou valores sensiveis.' });
  }
});

export const runtimeExecuteResponseV1Schema = z.object({
  specVersion: z.literal(runtimeExecuteResponseSpecVersionV1),
  trace: z.object({
    traceId: idSchema,
    runId: idSchema,
  }).strict(),
  status: z.enum(runtimeContractResponseStatusValues),
  output: z.object({
    text: z.string().trim().max(16000).optional(),
    format: z.enum(runtimeContractOutputFormatValues).optional(),
    metadata: runtimeContractSafeObjectSchema.optional(),
  }).strict().optional(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().safe().optional(),
    outputTokens: z.number().int().nonnegative().safe().optional(),
    totalTokens: z.number().int().nonnegative().safe().optional(),
    latencyMs: z.number().int().nonnegative().safe().optional(),
    estimatedCostMinorUnits: z.string().trim().regex(/^\d+$/).max(30).optional(),
    costCurrency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  }).strict().optional(),
  events: z.array(runtimeNormalizedEventV1Schema).max(200).optional(),
  error: runtimeNormalizedErrorV1Schema.optional(),
}).strict().superRefine((value, ctx) => {
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'response contem campos ou valores sensiveis.' });
  }
});

export const runtimeHealthResponseV1Schema = z.object({
  provider: z.literal('agno'),
  protocolVersion: z.literal(assistantRuntimeSpecVersionV1),
  status: z.enum(runtimeContractHealthStatusValues),
  checkedAt: z.string().datetime(),
  message: optionalTextSchema(1000),
  details: runtimeContractSafeObjectSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'health contem campos ou valores sensiveis.' });
  }
});

export const runtimeCapabilitiesResponseV1Schema = z.object({
  provider: z.literal('agno'),
  protocolVersion: z.literal(assistantRuntimeSpecVersionV1),
  supportsStreaming: z.boolean(),
  supportsTools: z.boolean(),
  supportsRagContext: z.boolean(),
  supportsFileInputs: z.boolean(),
  maxInputChars: z.number().int().positive().safe().optional(),
  maxToolCalls: z.number().int().nonnegative().max(50).optional(),
}).strict();

export function parseAssistantRuntimeSpecV1(value: unknown) {
  return assistantRuntimeSpecV1Schema.parse(value);
}

export function parseRuntimeExecuteRequestV1(value: unknown) {
  return runtimeExecuteRequestV1Schema.parse(value);
}

export function parseRuntimeExecuteResponseV1(value: unknown) {
  return runtimeExecuteResponseV1Schema.parse(value);
}

export function parseRuntimeNormalizedEventV1(value: unknown) {
  return runtimeNormalizedEventV1Schema.parse(value);
}

export function parseRuntimeNormalizedErrorV1(value: unknown) {
  return runtimeNormalizedErrorV1Schema.parse(value);
}

export function parseRuntimeHealthResponseV1(value: unknown) {
  return runtimeHealthResponseV1Schema.parse(value);
}

export function parseRuntimeCapabilitiesResponseV1(value: unknown) {
  return runtimeCapabilitiesResponseV1Schema.parse(value);
}

export function sanitizeRuntimeContractMetadata(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sensitiveStringPattern.test(value) ? '[redacted]' : value.slice(0, maxJsonStringChars);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  if (depth >= maxJsonDepth) return '[truncated]';
  if (Array.isArray(value)) {
    return value
      .slice(0, maxJsonArrayItems)
      .map((item) => sanitizeRuntimeContractMetadata(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }
  if (typeof value !== 'object') return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort().slice(0, maxJsonObjectKeys)) {
    if (hasUnsafeContractKey(key)) continue;
    const sanitizedValue = sanitizeRuntimeContractMetadata((value as Record<string, unknown>)[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}
