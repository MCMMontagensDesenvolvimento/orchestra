import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { catalogItems, protocolVersion, tools } from './catalog.js';

const defaultMaxPayloadBytes = 8_192;
const hardMaxPayloadBytes = 32_768;
const defaultRequestTimeoutMs = 5_000;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeRequestId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : undefined;
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

async function readJson(request, maxPayloadBytes) {
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    const error = new Error('unsupported_media_type');
    error.statusCode = 415;
    throw error;
  }
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxPayloadBytes) {
    const error = new Error('payload_too_large');
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > maxPayloadBytes) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function executeSearch(input) {
  if (!isRecord(input) || !hasOnlyKeys(input, new Set(['query', 'maxResults']))) return null;
  if (typeof input.query !== 'string' || input.query.trim().length < 1 || input.query.length > 80) return null;
  const maxResults = input.maxResults ?? 5;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 5) return null;
  const query = input.query.trim().toLowerCase();
  const matches = catalogItems
    .filter((item) => `${item.id} ${item.name} ${item.category} ${item.status}`.toLowerCase().includes(query))
    .slice(0, maxResults);
  return JSON.stringify({ matches });
}

function executeGetStatus(input) {
  if (!isRecord(input) || !hasOnlyKeys(input, new Set(['itemId']))) return null;
  if (typeof input.itemId !== 'string' || input.itemId.trim().length < 1 || input.itemId.length > 80) return null;
  const item = catalogItems.find((candidate) => candidate.id === input.itemId.trim());
  return item
    ? JSON.stringify({ found: true, itemId: item.id, status: item.status })
    : JSON.stringify({ found: false, itemId: input.itemId.trim(), status: 'not_found' });
}

function executeReadonlyTool(payload) {
  if (!isRecord(payload) || !hasOnlyKeys(payload, new Set(['executionId', 'toolName', 'input']))) return null;
  if (typeof payload.executionId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(payload.executionId)) return null;
  if (payload.toolName === 'catalog.search') return executeSearch(payload.input);
  if (payload.toolName === 'catalog.get_status') return executeGetStatus(payload.input);
  return undefined;
}

export function createDemoServer(options = {}) {
  const maxPayloadBytes = boundedInteger(
    options.maxPayloadBytes ?? process.env.MCP_READONLY_DEMO_MAX_PAYLOAD_BYTES,
    defaultMaxPayloadBytes,
    1_024,
    hardMaxPayloadBytes,
  );
  const requestTimeoutMs = boundedInteger(
    options.requestTimeoutMs ?? process.env.MCP_READONLY_DEMO_REQUEST_TIMEOUT_MS,
    defaultRequestTimeoutMs,
    100,
    30_000,
  );
  const logger = options.logger ?? ((entry) => console.log(JSON.stringify(entry)));

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    let statusCode = 500;
    const requestId = safeRequestId(request.headers['x-request-id']);
    const url = new URL(request.url ?? '/', 'http://mcp-readonly-demo');
    try {
      if (url.search || url.hash) {
        statusCode = 400;
        return sendJson(response, statusCode, { status: 'error', code: 'INVALID_REQUEST_TARGET' });
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        statusCode = 200;
        return sendJson(response, statusCode, { status: 'healthy', service: 'mcp-readonly-demo' });
      }
      if (request.method === 'GET' && url.pathname === '/ready') {
        statusCode = 200;
        return sendJson(response, statusCode, { status: 'ready', readOnly: true, protocolVersion });
      }
      if (request.method === 'GET' && url.pathname === '/v1/catalog') {
        statusCode = 200;
        return sendJson(response, statusCode, {
          status: 'ready',
          protocolVersion,
          server: { name: 'Orchestra MCP Read-only Demo', readOnly: true, dataClassification: 'fictitious' },
          tools,
        });
      }
      if (request.method === 'POST' && url.pathname === '/v1/tools/call') {
        const payload = await readJson(request, maxPayloadBytes);
        const content = executeReadonlyTool(payload);
        if (content === undefined) {
          statusCode = 404;
          return sendJson(response, statusCode, { status: 'error', code: 'READONLY_TOOL_NOT_FOUND' });
        }
        if (content === null) {
          statusCode = 422;
          return sendJson(response, statusCode, { status: 'error', code: 'INVALID_TOOL_ARGUMENTS' });
        }
        statusCode = 200;
        return sendJson(response, statusCode, { status: 'completed', content, simulated: false });
      }
      statusCode = 404;
      return sendJson(response, statusCode, { status: 'error', code: 'ROUTE_NOT_FOUND' });
    } catch (error) {
      statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      const code = statusCode === 413
        ? 'PAYLOAD_TOO_LARGE'
        : statusCode === 415
          ? 'UNSUPPORTED_MEDIA_TYPE'
          : statusCode === 400
            ? 'INVALID_JSON'
            : 'REQUEST_FAILED';
      return sendJson(response, statusCode, { status: 'error', code });
    } finally {
      logger({
        level: statusCode >= 500 ? 'error' : 'info',
        event: 'mcp_readonly_demo_request',
        method: request.method,
        path: url.pathname,
        statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
        ...(requestId ? { requestId } : {}),
      });
    }
  });
  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs;
  server.keepAliveTimeout = Math.min(requestTimeoutMs, 5_000);
  return server;
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const port = boundedInteger(process.env.MCP_READONLY_DEMO_PORT, 8_092, 1, 65_535);
  const host = process.env.MCP_READONLY_DEMO_HOST || '0.0.0.0';
  createDemoServer().listen(port, host, () => {
    console.log(JSON.stringify({ level: 'info', event: 'mcp_readonly_demo_started', host, port, readOnly: true }));
  });
}
