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
export const runtimeToolGatewayErrorCodeValues = [
  'TOOL_GATEWAY_DISABLED',
  'TOOL_CALL_BLOCKED',
  'TOOL_CALL_RUN_UNAVAILABLE',
  'TOOL_CALL_NOT_AUTHORIZED',
  'TOOL_CALL_LIMIT_EXCEEDED',
  'TOOL_CALL_INVALID_ARGUMENTS',
  'TOOL_CALL_IDEMPOTENCY_CONFLICT',
  'TOOL_CALL_GOVERNANCE_FAILURE',
] as const;
export const runtimeToolGatewayReasonValues = [
  'gateway_disabled',
  'run_unavailable',
  'run_not_executable',
  'trace_mismatch',
  'assistant_mismatch',
  'tool_not_in_spec',
  'tool_policy_blocked',
  'approval_required',
  'risk_not_low',
  'max_tool_calls_zero',
  'max_tool_calls_exceeded',
  'sequence_out_of_order',
  'invalid_arguments',
  'idempotency_conflict',
  'mcp_remote_policy_blocked',
  'mcp_remote_egress_blocked',
  'mcp_remote_client_failed',
  'governance_failure',
] as const;

export const runtimeMcpRemoteBlockedReasonValues = [
  'remote_disabled',
  'execution_disabled',
  'readonly_disabled',
  'write_tools_not_allowed',
  'tool_not_readonly',
  'dangerous_operation',
  'risk_not_low',
  'approval_required',
  'runtime_execution_not_allowed',
  'sandbox_only',
  'blocked_by_default',
  'secret_ref_required',
  'egress_blocked',
  'client_failed',
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
  'gatewayurl',
  'internalurl',
  'password',
  'providerapikey',
  'rawpayload',
  'rawdocuments',
  'rawmcpserverconfig',
  'rawprompt',
  'rawproviderresponse',
  'rawresponse',
  'rawtool',
  'rawtoolmanifest',
  'stack',
  'secret',
  'secretref',
  'serverurl',
  'token',
  'toolargs',
  'tooloutput',
  'toolresult',
]);

const allowedRuntimeContractTokenMetricKeys = new Set([
  'maxtokens',
  'inputtokens',
  'outputtokens',
  'totaltokens',
]);

const sensitiveStringPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9_-]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;
const internalUrlPattern = /https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[^/\s]+\.(?:internal|local))(?::\d+)?(?:[/?#\s]|$)/i;
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
  if (typeof value === 'string') return sensitiveStringPattern.test(value) || internalUrlPattern.test(value);
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

const allowedPublicRuntimeMetricKeys = new Set([
  'approvalrequiredcount',
  'maxragresults',
  'tooldescriptorcount',
]);
const unsafePublicRuntimeMetadataKeyFragments = ['argument', 'descriptor', 'payload', 'raw', 'result', 'schema', 'stack'];

function containsUnsafePublicRuntimeMetadata(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return false;
  if (typeof value === 'undefined' || depth > maxJsonDepth) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafePublicRuntimeMetadata(item, depth + 1));
  if (typeof value !== 'object') return true;

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    const normalized = normalizedKey(key);
    const unsafeKey = !allowedPublicRuntimeMetricKeys.has(normalized)
      && unsafePublicRuntimeMetadataKeyFragments.some((fragment) => normalized.includes(fragment));
    return unsafeKey || containsUnsafePublicRuntimeMetadata(entry, depth + 1);
  });
}

const runtimeContractPublicSafeObjectSchema = runtimeContractSafeObjectSchema
  .refine((value) => !containsUnsafePublicRuntimeMetadata(value), 'metadata publica contem payload detalhado de runtime/tool.');

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
  role: z.enum(['user', 'assistant']),
  content: textSchema(4000),
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

const runtimeToolDescriptorMetadataSchema = z.object({
  bindingId: idSchema.optional(),
  descriptorIndex: z.number().int().positive().max(50).optional(),
  source: z.literal('orchestra_mcp_catalog'),
}).strict();

export const runtimeToolDescriptorSchema = z.object({
  toolId: idSchema,
  name: textSchema(120),
  description: optionalTextSchema(1000),
  riskLevel: z.enum(runtimeContractToolRiskLevelValues).default('medium'),
  approvalRequired: z.boolean(),
  inputSchema: runtimeContractSafeObjectSchema.optional(),
  metadata: runtimeToolDescriptorMetadataSchema.optional(),
  gatewayRef: z.object({
    type: z.literal('orchestra_tool_gateway'),
    action: z.literal('mcp.tool.execute'),
  }).strict(),
}).strict();

export const runtimeToolGatewayRequestSchema = z.object({
  runtimeTraceId: idSchema,
  agentRunId: idSchema,
  assistantId: idSchema,
  toolCallId: idSchema,
  toolId: idSchema,
  arguments: runtimeContractSafeObjectSchema,
  sequence: z.number().int().positive().max(50),
}).strict().superRefine((value, ctx) => {
  if (approximateJsonSize(value) > 32_768) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tool request excede o limite permitido.' });
  }
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['arguments'], message: 'tool request contem argumentos inseguros.' });
  }
});

export const runtimeToolGatewayResponseSchema = z.object({
  toolCallId: idSchema,
  status: z.enum(['succeeded', 'blocked']),
  result: z.object({
    content: textSchema(1000),
  }).strict().optional(),
  error: z.object({
    code: z.enum(runtimeToolGatewayErrorCodeValues),
    message: textSchema(300),
    retryable: z.literal(false),
  }).strict().optional(),
  metadata: z.object({
    toolCallsExecuted: z.number().int().min(0).max(50),
    externalMcpCalled: z.boolean(),
    simulated: z.boolean(),
    failedClosed: z.boolean(),
    reason: z.enum(runtimeToolGatewayReasonValues).optional(),
    mcpRemoteEvaluationApplied: z.boolean().optional(),
    mcpRemoteAllowed: z.boolean().optional(),
    mcpRemoteBlocked: z.boolean().optional(),
    mcpRemoteReadOnly: z.boolean().optional(),
    mcpRemoteBlockedReason: z.enum(runtimeMcpRemoteBlockedReasonValues).optional(),
    mcpRemoteHost: z.string().trim().min(1).max(253).regex(/^[A-Za-z0-9.:[\]-]+$/).optional(),
    mcpRemoteToolId: idSchema.optional(),
    mcpRemoteRiskLevel: z.enum(runtimeContractToolRiskLevelValues).optional(),
    responseBytes: z.number().int().nonnegative().max(1_048_576).optional(),
    latencyMs: z.number().int().nonnegative().max(300000),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'succeeded' && (!value.result || value.error)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tool response de sucesso exige somente result.' });
  }
  if (value.status === 'blocked' && (!value.error || value.result)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tool response bloqueada exige somente error.' });
  }
  if (value.metadata.externalMcpCalled && (
    value.metadata.mcpRemoteAllowed !== true
    || value.metadata.mcpRemoteReadOnly !== true
    || value.metadata.mcpRemoteBlocked === true
  )) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['metadata'], message: 'chamada MCP externa exige avaliacao read-only permitida.' });
  }
  if (containsUnsafeRuntimeContractPayload(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tool response contem payload inseguro.' });
  }
});

export const runtimeNormalizedEventV1Schema = z.object({
  eventId: idSchema,
  traceId: idSchema,
  runId: idSchema,
  type: z.enum(runtimeContractEventTypeValues),
  timestamp: z.string().datetime(),
  status: z.enum(runtimeContractEventStatusValues),
  message: optionalTextSchema(1000),
  metadata: runtimeContractPublicSafeObjectSchema.optional(),
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
  details: runtimeContractPublicSafeObjectSchema.optional(),
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
  if (value.tools.enabled && value.tools.mode !== 'gateway') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tools', 'mode'], message: 'tools habilitadas exigem mode gateway.' });
  }
  if (value.tools.mode === 'gateway' && value.tools.descriptors.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tools', 'descriptors'], message: 'tools gateway exigem descriptors governados.' });
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
    metadata: runtimeContractPublicSafeObjectSchema.optional(),
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

const runtimeModelCatalogV1Schema = z.object({
  provider: z.enum(['openai', 'azure_openai', 'anthropic']),
  models: z.array(
    z.string().trim().min(1).max(160),
  ).min(1).max(1000),
  defaultModel: z.string().trim().min(1).max(160),
}).strict().superRefine((value, ctx) => {
  if (!value.models.includes(value.defaultModel)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultModel'],
      message: 'defaultModel deve pertencer ao catalogo de modelos permitido.',
    });
  }
});

export const runtimeCapabilitiesResponseV1Schema = z.object({
  provider: z.literal('agno'),
  protocolVersion: z.literal(assistantRuntimeSpecVersionV1),
  supportsStreaming: z.boolean(),
  supportsTools: z.boolean(),
  supportsRagContext: z.boolean(),
  supportsExternalProviders: z.boolean().optional(),
  supportsFileInputs: z.boolean(),
  maxInputChars: z.number().int().positive().safe().optional(),
  maxToolCalls: z.number().int().nonnegative().max(50).optional(),
  modelCatalog: runtimeModelCatalogV1Schema.optional(),
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
  if (typeof value === 'string') return sensitiveStringPattern.test(value) || internalUrlPattern.test(value)
    ? '[redacted]'
    : value.slice(0, maxJsonStringChars);
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
