import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const maxRequestBytes = 262_144;
const allowedToolNames = new Set(['catalog.search', 'catalog.get_status']);
const allowedMetadataKeys = new Set([
  'externalMcpCalled',
  'simulated',
  'mcpRemoteEvaluationApplied',
  'mcpRemoteAllowed',
  'mcpRemoteBlocked',
  'mcpRemoteReadOnly',
  'mcpRemoteBlockedReason',
  'mcpRemoteHost',
  'mcpRemoteToolId',
  'mcpRemoteRiskLevel',
  'responseBytes',
  'toolCallsExecuted',
  'failedClosed',
]);

function boundedPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function controlledUrl(value, expectedHost, expectedPath = '') {
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'http:'
    || parsed.hostname !== expectedHost
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || parsed.pathname.replace(/\/$/, '') !== expectedPath
  ) throw new Error('invalid_controlled_url');
  return parsed.origin + expectedPath;
}

function sameCredential(provided, expected) {
  const left = Buffer.from(provided ?? '', 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > maxRequestBytes) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('invalid_controlled_response');
  }
  return { status: response.status, ok: response.ok, body };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function selectDescriptor(payload) {
  const descriptors = payload?.assistantRuntimeSpec?.tools?.descriptors;
  if (!Array.isArray(descriptors)) return null;
  return descriptors.find((descriptor) => (
    isRecord(descriptor)
    && typeof descriptor.toolId === 'string'
    && allowedToolNames.has(descriptor.name)
    && descriptor.riskLevel === 'low'
    && descriptor.approvalRequired === false
  )) ?? null;
}

function argumentsFor(descriptor) {
  if (descriptor.name === 'catalog.search') return { query: 'service', maxResults: 2 };
  if (descriptor.name === 'catalog.get_status') return { itemId: 'svc-catalog' };
  throw new Error('tool_not_allowlisted');
}

function safeGatewayMetadata(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => (
    allowedMetadataKeys.has(key)
    && (typeof item === 'boolean' || typeof item === 'number' || typeof item === 'string')
  )));
}

function mergeGatewayResult(runtimeBody, gatewayBody, spec) {
  if (!isRecord(runtimeBody) || runtimeBody.status !== 'succeeded' || !isRecord(runtimeBody.output)) {
    throw new Error('upstream_execution_failed');
  }
  const data = gatewayBody?.data;
  if (!isRecord(data) || !isRecord(data.metadata)) throw new Error('invalid_gateway_response');
  const metadata = safeGatewayMetadata(data.metadata);
  const succeeded = data.status === 'succeeded';
  const eventType = succeeded ? 'tool.completed' : 'tool.blocked';
  const eventStatus = succeeded ? 'completed' : 'blocked';
  const event = {
    eventId: `phase16r-${randomUUID()}`,
    traceId: spec.trace.traceId,
    runId: spec.trace.runId,
    type: eventType,
    timestamp: new Date().toISOString(),
    status: eventStatus,
    metadata,
  };
  return {
    ...runtimeBody,
    output: {
      ...runtimeBody.output,
      metadata: {
        ...(isRecord(runtimeBody.output.metadata) ? runtimeBody.output.metadata : {}),
        ...metadata,
      },
    },
    events: [...(Array.isArray(runtimeBody.events) ? runtimeBody.events : []), event],
  };
}

export function createE2eRuntimeProxy(options = {}) {
  const credential = options.credential ?? process.env.AGNO_RUNTIME_HTTP_SECURITY_KEY ?? '';
  if (!/^[A-Za-z0-9._~+/-]{16,512}=*$/.test(credential)) throw new Error('invalid_runtime_credential');
  const upstreamBaseUrl = controlledUrl(
    options.upstreamBaseUrl ?? process.env.ORCHESTRA_16R_UPSTREAM_AGNO_BASE_URL ?? 'http://agno-bridge:8091',
    options.upstreamHost ?? 'agno-bridge',
  );
  const gatewayUrl = controlledUrl(
    options.gatewayUrl ?? process.env.ORCHESTRA_TOOL_GATEWAY_URL ?? 'http://backend:3000/api/v1/runtime/agno/tool-calls',
    options.gatewayHost ?? 'backend',
    '/api/v1/runtime/agno/tool-calls',
  );
  const logger = options.logger ?? ((entry) => console.log(JSON.stringify(entry)));

  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const path = new URL(request.url ?? '/', 'http://e2e-runtime-16r').pathname;
    let statusCode = 500;
    try {
      if (!sameCredential(request.headers.authorization, `Bearer ${credential}`)) {
        statusCode = 401;
        return sendJson(response, statusCode, { error: { code: 'UNAUTHORIZED', message: 'Runtime authentication failed.' } });
      }
      if (request.method === 'GET' && (path === '/health' || path === '/capabilities')) {
        const upstream = await requestJson(`${upstreamBaseUrl}${path}`, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${credential}` },
        });
        statusCode = upstream.status;
        return sendJson(response, statusCode, upstream.body);
      }
      if (request.method !== 'POST' || path !== '/execute') {
        statusCode = 404;
        return sendJson(response, statusCode, { error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' } });
      }

      const payload = await readJson(request);
      const spec = payload?.assistantRuntimeSpec;
      if (
        payload?.specVersion !== 'orchestra.runtime.execute.v1'
        || !isRecord(spec)
        || !isRecord(spec.trace)
        || !isRecord(spec.assistant)
      ) throw new Error('invalid_runtime_request');

      const upstream = await requestJson(`${upstreamBaseUrl}/execute`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok) {
        statusCode = upstream.status;
        return sendJson(response, statusCode, upstream.body);
      }

      const descriptor = selectDescriptor(payload);
      if (!descriptor) throw new Error('governed_readonly_tool_missing');
      const gateway = await requestJson(gatewayUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runtimeTraceId: spec.trace.traceId,
          agentRunId: spec.trace.runId,
          assistantId: spec.assistant.id,
          toolCallId: `phase16r-${randomUUID()}`,
          toolId: descriptor.toolId,
          arguments: argumentsFor(descriptor),
          sequence: 1,
        }),
      });
      if (!gateway.ok) throw new Error('governed_gateway_unavailable');
      const result = mergeGatewayResult(upstream.body, gateway.body, spec);
      statusCode = 200;
      return sendJson(response, statusCode, result);
    } catch {
      statusCode = 502;
      return sendJson(response, statusCode, {
        specVersion: 'orchestra.runtime.response.v1',
        trace: { traceId: 'phase16r-failed', runId: 'phase16r-failed' },
        status: 'failed',
        error: {
          code: 'RUNTIME_UNKNOWN_ERROR',
          message: 'The controlled 16R runtime fixture failed closed.',
          retryable: false,
          httpStatus: 502,
        },
      });
    } finally {
      logger({
        level: statusCode >= 500 ? 'error' : 'info',
        event: 'phase16r_runtime_request',
        method: request.method,
        path,
        statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    }
  });
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const host = process.env.ORCHESTRA_16R_RUNTIME_HOST || '0.0.0.0';
  const port = boundedPort(process.env.ORCHESTRA_16R_RUNTIME_PORT, 8_093);
  createE2eRuntimeProxy().listen(port, host, () => {
    console.log(JSON.stringify({ level: 'info', event: 'phase16r_runtime_started', host, port }));
  });
}
