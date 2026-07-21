import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createE2eRuntimeProxy } from '../runtime-proxy.mjs';

const credential = 'phase16r-runtime-key';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function jsonServer(handler) {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
    const result = handler(request, body);
    const serialized = JSON.stringify(result.body);
    response.writeHead(result.status ?? 200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(serialized) });
    response.end(serialized);
  });
}

test('merges only safe real MCP metadata and never returns tool content', async () => {
  const upstream = jsonServer((request, body) => ({
    body: request.url === '/health'
      ? { provider: 'agno', protocolVersion: 'orchestra.runtime.assistant.v1', status: 'healthy', checkedAt: new Date().toISOString() }
      : {
        specVersion: 'orchestra.runtime.response.v1',
        trace: body.assistantRuntimeSpec.trace,
        status: 'succeeded',
        output: { text: 'Deterministic fixture response.', format: 'text', metadata: { externalProviderCalled: false, simulated: true } },
        events: [],
      },
  }));
  const gateway = jsonServer((_request, body) => ({
    body: {
      data: {
        toolCallId: body.toolCallId,
        status: 'succeeded',
        result: { content: 'must-not-be-forwarded' },
        metadata: {
          toolCallsExecuted: 1,
          externalMcpCalled: true,
          simulated: false,
          failedClosed: false,
          mcpRemoteEvaluationApplied: true,
          mcpRemoteAllowed: true,
          mcpRemoteBlocked: false,
          mcpRemoteReadOnly: true,
          mcpRemoteHost: 'mcp-readonly-demo:8092',
          responseBytes: 42,
          latencyMs: 1,
          ignoredField: 'must-not-be-forwarded',
        },
      },
    },
  }));
  const upstreamPort = await listen(upstream);
  const gatewayPort = await listen(gateway);
  const proxy = createE2eRuntimeProxy({
    credential,
    upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
    upstreamHost: '127.0.0.1',
    gatewayUrl: `http://127.0.0.1:${gatewayPort}/api/v1/runtime/agno/tool-calls`,
    gatewayHost: '127.0.0.1',
    logger: () => {},
  });
  const proxyPort = await listen(proxy);

  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specVersion: 'orchestra.runtime.execute.v1',
        assistantRuntimeSpec: {
          trace: { traceId: 'trace-16r', runId: 'run-16r' },
          assistant: { id: 'assistant-16r' },
          tools: { descriptors: [{ toolId: 'tool-16r', name: 'catalog.search', riskLevel: 'low', approvalRequired: false }] },
        },
      }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.output.metadata.externalMcpCalled, true);
    assert.equal(result.output.metadata.simulated, false);
    assert.equal(result.output.metadata.mcpRemoteReadOnly, true);
    assert.equal(JSON.stringify(result).includes('must-not-be-forwarded'), false);
  } finally {
    await Promise.all([close(proxy), close(upstream), close(gateway)]);
  }
});

test('rejects unauthenticated execution before contacting controlled services', async () => {
  let calls = 0;
  const upstream = jsonServer(() => {
    calls += 1;
    return { body: {} };
  });
  const gateway = jsonServer(() => {
    calls += 1;
    return { body: {} };
  });
  const upstreamPort = await listen(upstream);
  const gatewayPort = await listen(gateway);
  const proxy = createE2eRuntimeProxy({
    credential,
    upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
    upstreamHost: '127.0.0.1',
    gatewayUrl: `http://127.0.0.1:${gatewayPort}/api/v1/runtime/agno/tool-calls`,
    gatewayHost: '127.0.0.1',
    logger: () => {},
  });
  const proxyPort = await listen(proxy);
  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/execute`, { method: 'POST' });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  } finally {
    await Promise.all([close(proxy), close(upstream), close(gateway)]);
  }
});
