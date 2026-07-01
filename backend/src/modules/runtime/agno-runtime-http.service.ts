import { ZodError } from 'zod';
import {
  assistantRuntimeSpecVersionV1,
  runtimeCapabilitiesResponseV1Schema,
  runtimeExecuteRequestV1Schema,
  runtimeExecuteResponseSpecVersionV1,
  runtimeExecuteResponseV1Schema,
  runtimeHealthResponseV1Schema,
  runtimeNormalizedErrorV1Schema,
} from './runtime-contract.schema';
import type {
  AssistantRuntimeSpecV1,
  RuntimeCapabilitiesResponseV1,
  RuntimeExecuteResponseV1,
  RuntimeHealthResponseV1,
  RuntimeNormalizedErrorV1,
  RuntimeNormalizedEventV1,
} from './runtime-contract.types';

const invalidTrace = {
  traceId: 'invalid-request',
  runId: 'invalid-run',
};

type RuntimeTrace = RuntimeExecuteResponseV1['trace'];

interface RuntimeHttpResult {
  httpStatus: number;
  body: RuntimeExecuteResponseV1;
}

export function agnoRuntimeHttpHealth(now = new Date()): RuntimeHealthResponseV1 {
  return runtimeHealthResponseV1Schema.parse({
    provider: 'agno',
    protocolVersion: assistantRuntimeSpecVersionV1,
    status: 'healthy',
    checkedAt: now.toISOString(),
    message: 'Agno-compatible runtime contract service is healthy.',
    details: {
      mode: 'sandbox',
      externalProvidersCalled: false,
      databaseCalled: false,
    },
  });
}

export function agnoRuntimeHttpCapabilities(): RuntimeCapabilitiesResponseV1 {
  return runtimeCapabilitiesResponseV1Schema.parse({
    provider: 'agno',
    protocolVersion: assistantRuntimeSpecVersionV1,
    supportsStreaming: false,
    supportsTools: false,
    supportsRagContext: true,
    supportsFileInputs: false,
    maxInputChars: 16000,
    maxToolCalls: 0,
  });
}

export function executeAgnoRuntimeHttpContract(input: unknown, now = new Date()): RuntimeHttpResult {
  const startedAt = Date.now();
  const parsed = runtimeExecuteRequestV1Schema.safeParse(input);
  if (!parsed.success) {
    return runtimeErrorResult({
      trace: traceFromUnknown(input),
      httpStatus: 400,
      status: 'failed',
      code: zodErrorCode(parsed.error),
      message: 'Runtime request payload is invalid.',
      retryable: false,
      details: zodErrorDetails(parsed.error),
    });
  }

  const spec = parsed.data.assistantRuntimeSpec;
  const events: RuntimeNormalizedEventV1[] = [
    runtimeEvent(1, spec.trace, 'run.started', 'running', now, {
      mode: 'sandbox',
    }),
  ];

  const policyBlock = evaluate14BPolicy(spec);
  if (policyBlock) {
    return runtimeErrorResult({
      trace: responseTrace(spec),
      httpStatus: 403,
      status: 'blocked',
      code: 'RUNTIME_POLICY_BLOCKED',
      message: policyBlock,
      retryable: false,
      details: {
        mode: 'sandbox',
        toolsExecuted: false,
      },
      events: [
        ...events,
        runtimeEvent(2, responseTrace(spec), 'run.failed', 'blocked', now, {
          mode: 'sandbox',
        }),
      ],
    });
  }

  const ragSourceCount = spec.rag.sources.length;
  const toolDescriptorCount = spec.tools.descriptors.length;
  const completedEvents: RuntimeNormalizedEventV1[] = [
    ...events,
    runtimeEvent(2, spec.trace, 'model.requested', 'running', now, {
      provider: spec.model.provider,
      model: spec.model.model,
      externalProviderCalled: false,
    }),
    runtimeEvent(3, spec.trace, 'model.completed', 'completed', now, {
      provider: spec.model.provider,
      outputMode: 'deterministic_sandbox',
    }),
  ];

  let eventSequence = 4;

  if (ragSourceCount > 0) {
    completedEvents.push(runtimeEvent(eventSequence, spec.trace, 'rag.context.attached', 'completed', now, {
      ragSourceCount,
      ragMode: spec.rag.mode,
    }));
    eventSequence += 1;
  }

  if (toolDescriptorCount > 0) {
    completedEvents.push(runtimeEvent(eventSequence, spec.trace, 'tool.descriptors.attached', 'completed', now, {
      toolDescriptorCount,
      toolMode: spec.tools.mode,
      maxToolCalls: spec.policy.maxToolCalls,
      toolIds: spec.tools.descriptors.map((descriptor) => descriptor.toolId).slice(0, 20),
    }));
    eventSequence += 1;
  }

  if (toolDescriptorCount > 0 && spec.policy.maxToolCalls === 0) {
    completedEvents.push(runtimeEvent(eventSequence, spec.trace, 'tool.blocked', 'blocked', now, {
      reason: 'max_tool_calls_zero',
      toolDescriptorCount,
      maxToolCalls: spec.policy.maxToolCalls,
      externalMcpCalled: false,
      toolCallsExecuted: 0,
    }));
    eventSequence += 1;
  }

  completedEvents.push(runtimeEvent(eventSequence, spec.trace, 'run.completed', 'completed', now, {
    mode: 'sandbox',
    externalProviderCalled: false,
    externalMcpCalled: false,
    toolCallsExecuted: 0,
  }));

  const response: RuntimeExecuteResponseV1 = {
    specVersion: runtimeExecuteResponseSpecVersionV1,
    trace: {
      traceId: spec.trace.traceId,
      runId: spec.trace.runId,
    },
    status: 'succeeded',
    output: {
      text: 'Resposta sandbox do runtime Agno-compatible minimo. Nenhum provider externo foi chamado.',
      format: 'text',
      metadata: {
        mode: 'sandbox',
        inputChars: spec.input.message.length,
        ragSourceCount,
        toolDescriptorCount,
        externalMcpCalled: false,
        toolCallsExecuted: 0,
      },
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: Math.max(0, Date.now() - startedAt),
      estimatedCostMinorUnits: '0',
      costCurrency: 'BRL',
    },
    events: completedEvents,
  };

  return {
    httpStatus: 200,
    body: runtimeExecuteResponseV1Schema.parse(response),
  };
}

export function invalidJsonResult(httpStatus = 400): RuntimeHttpResult {
  return runtimeErrorResult({
    trace: invalidTrace,
    httpStatus,
    status: 'failed',
    code: 'RUNTIME_BAD_REQUEST',
    message: httpStatus === 413 ? 'Runtime request payload is too large.' : 'Runtime request body must be valid JSON.',
    retryable: false,
  });
}

export function unsupportedMediaTypeResult(): RuntimeHttpResult {
  return runtimeErrorResult({
    trace: invalidTrace,
    httpStatus: 415,
    status: 'failed',
    code: 'RUNTIME_BAD_REQUEST',
    message: 'Runtime execute endpoint accepts application/json only.',
    retryable: false,
  });
}

export function unknownRuntimeErrorResult(): RuntimeHttpResult {
  return runtimeErrorResult({
    trace: invalidTrace,
    httpStatus: 500,
    status: 'failed',
    code: 'RUNTIME_UNKNOWN_ERROR',
    message: 'Runtime service returned an unexpected error.',
    retryable: true,
  });
}

function responseTrace(spec: AssistantRuntimeSpecV1): RuntimeTrace {
  return {
    traceId: spec.trace.traceId,
    runId: spec.trace.runId,
  };
}

function evaluate14BPolicy(spec: AssistantRuntimeSpecV1) {
  if (spec.limits.blockedBeforeRuntime) return 'Request was marked blocked before runtime execution.';
  return null;
}

function runtimeErrorResult(input: {
  trace: RuntimeTrace;
  httpStatus: number;
  status: 'failed' | 'blocked';
  code: RuntimeNormalizedErrorV1['code'];
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  events?: RuntimeNormalizedEventV1[];
}): RuntimeHttpResult {
  const errorInput: Record<string, unknown> = {
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    httpStatus: input.httpStatus,
  };
  if (input.details) errorInput.details = input.details;

  const responseInput: Record<string, unknown> = {
    specVersion: runtimeExecuteResponseSpecVersionV1,
    trace: input.trace,
    status: input.status,
    error: runtimeNormalizedErrorV1Schema.parse(errorInput),
  };
  if (input.events) responseInput.events = input.events;

  const response = runtimeExecuteResponseV1Schema.parse(responseInput);

  return {
    httpStatus: input.httpStatus,
    body: response,
  };
}

function runtimeEvent(
  sequence: number,
  trace: RuntimeTrace,
  type: RuntimeNormalizedEventV1['type'],
  status: RuntimeNormalizedEventV1['status'],
  now: Date,
  metadata: NonNullable<RuntimeNormalizedEventV1['metadata']>,
): RuntimeNormalizedEventV1 {
  return {
    eventId: `runtime-event-${sequence}`,
    traceId: trace.traceId,
    runId: trace.runId,
    type,
    timestamp: now.toISOString(),
    status,
    metadata,
  };
}

function zodErrorCode(error: ZodError): RuntimeNormalizedErrorV1['code'] {
  return error.issues.some((issue) => issue.code === 'invalid_literal')
    ? 'RUNTIME_BAD_REQUEST'
    : 'RUNTIME_BAD_REQUEST';
}

function zodErrorDetails(error: ZodError) {
  return {
    issueCount: error.issues.length,
  };
}

function traceFromUnknown(input: unknown): RuntimeTrace {
  if (!isRecord(input)) return invalidTrace;
  const spec = input.assistantRuntimeSpec;
  if (!isRecord(spec)) return invalidTrace;
  const trace = spec.trace;
  if (!isRecord(trace)) return invalidTrace;

  return {
    traceId: safeTraceId(trace.traceId, invalidTrace.traceId),
    runId: safeTraceId(trace.runId, invalidTrace.runId),
  };
}

function safeTraceId(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  return /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
