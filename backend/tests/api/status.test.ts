import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app/app';

const fixedUpdatedAt = '2026-07-22T19:40:05.000Z';
const forbiddenFields = [
  'user',
  'email',
  'tenant',
  'workspace',
  'prompt',
  'context',
  'args',
  'output',
  'headers',
  'cookies',
  'Authorization',
  'env',
  'stack',
  'dependencyVersions',
  'DATABASE_URL',
  'connectionString',
  'secrets',
  'apiKey',
  'internalPath',
  'privateHost',
  'database',
  'metrics',
];

function createStatusApp() {
  return createApp({ now: () => new Date(fixedUpdatedAt) });
}

function expectSafeStatusPayload(body: Record<string, unknown>, summary: string) {
  expect(body).toEqual({
    status: 'ok',
    summary,
    updatedAt: fixedUpdatedAt,
  });
  expect(Object.keys(body).sort()).toEqual(['status', 'summary', 'updatedAt'].sort());
  expect(new Date(String(body.updatedAt)).toISOString()).toBe(body.updatedAt);

  for (const field of forbiddenFields) {
    expect(body).not.toHaveProperty(field);
  }
}

describe('read-only operational status endpoints', () => {
  it('returns a sanitized status summary as JSON', async () => {
    const response = await request(createStatusApp())
      .get('/v1/status')
      .expect('Content-Type', /json/)
      .expect(200);

    expectSafeStatusPayload(response.body, 'Orchestra operational');
  });

  it('returns a sanitized availability summary as JSON', async () => {
    const response = await request(createStatusApp())
      .get('/v1/status/availability')
      .expect('Content-Type', /json/)
      .expect(200);

    expectSafeStatusPayload(
      response.body,
      'Orchestra availability endpoint operational',
    );
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'does not expose %s mutations for either status path',
    async (method) => {
      const app = createStatusApp();

      await request(app)[method]('/v1/status').expect(404);
      await request(app)[method]('/v1/status/availability').expect(404);
    },
  );

  it('preserves the existing health endpoint contract', async () => {
    const response = await request(createStatusApp()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('orchestra-backend');
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(response.body.requestId).toMatch(/^req_/);
  });
});
