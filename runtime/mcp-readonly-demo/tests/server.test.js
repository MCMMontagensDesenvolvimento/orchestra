import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createDemoServer } from '../server.js';

let server;
let baseUrl;
const logs = [];

before(async () => {
  server = createDemoServer({ logger: (entry) => logs.push(entry) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

test('exposes safe health, readiness and a read-only catalog', async () => {
  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  const readiness = await fetch(`${baseUrl}/ready`).then((response) => response.json());
  const catalog = await fetch(`${baseUrl}/v1/catalog`).then((response) => response.json());

  assert.equal(health.status, 'healthy');
  assert.equal(readiness.readOnly, true);
  assert.deepEqual(catalog.tools.map((tool) => tool.externalName), ['catalog.search', 'catalog.get_status']);
  assert.ok(catalog.tools.every((tool) => tool.readOnly === true && tool.riskLevel === 'low'));
  assert.doesNotMatch(JSON.stringify(catalog), /secret|token|api.?key|password/i);
});

test('executes only the allowlisted read-only tools with fictitious data', async () => {
  const response = await fetch(`${baseUrl}/v1/tools/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'req_demo_test' },
    body: JSON.stringify({ executionId: 'exec-1', toolName: 'catalog.search', input: { query: 'service', maxResults: 2 } }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.status, 'completed');
  assert.equal(result.simulated, false);
  assert.equal(JSON.parse(result.content).matches.length, 2);
  assert.ok(logs.some((entry) => entry.requestId === 'req_demo_test'));
  assert.doesNotMatch(JSON.stringify(logs), /exec-1|service/i);
});

test('rejects unknown/write-like tools, invalid arguments and oversized payloads', async () => {
  const unknown = await fetch(`${baseUrl}/v1/tools/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ executionId: 'exec-2', toolName: 'catalog.delete', input: { itemId: 'svc-search' } }),
  });
  const invalid = await fetch(`${baseUrl}/v1/tools/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ executionId: 'exec-3', toolName: 'catalog.get_status', input: { itemId: 'svc-search', write: true } }),
  });
  const oversized = await fetch(`${baseUrl}/v1/tools/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ executionId: 'exec-4', toolName: 'catalog.search', input: { query: 'x'.repeat(9_000) } }),
  });

  assert.equal(unknown.status, 404);
  assert.equal(invalid.status, 422);
  assert.equal(oversized.status, 413);
});

test('does not expose mutation routes or accept query-bearing request targets', async () => {
  const mutation = await fetch(`${baseUrl}/v1/catalog`, { method: 'DELETE' });
  const query = await fetch(`${baseUrl}/v1/catalog?token=forbidden`);
  assert.equal(mutation.status, 404);
  assert.equal(query.status, 400);
});
