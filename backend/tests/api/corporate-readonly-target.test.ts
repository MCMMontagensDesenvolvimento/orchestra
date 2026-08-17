import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { logger } from '../../src/infrastructure/logger/logger';
import type { CorporateReadonlyTargetConfig } from '../../src/modules/corporate-readonly-target/corporate-readonly-target.config';

const targetToken = 'synthetic-corporate-readonly-status-token';
const sensitiveMarker = 'SUPER_SECRET_MARKER_18F';
const fixedUpdatedAt = '2026-08-17T12:00:00.000Z';
const corporateBasePath = '/v1/corporate-readonly';

function targetApp(config: CorporateReadonlyTargetConfig = { enabled: true, token: targetToken }) {
  return createApp({
    now: () => new Date(fixedUpdatedAt),
    corporateReadonlyTargetConfig: () => config,
  });
}

function authenticated(requestBuilder: request.Test) {
  return requestBuilder.set('Authorization', `Bearer ${targetToken}`);
}

function expectSanitized(body: unknown) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(targetToken);
  expect(serialized).not.toMatch(/authorization|secretRef|headers|raw.?secret/i);
}

describe('authenticated corporate read-only target boundary', () => {
  it('blocks missing, empty, incorrect, Basic, query, and body credentials identically', async () => {
    const app = targetApp();
    const responses = await Promise.all([
      request(app).get(`${corporateBasePath}/health`).expect(401),
      request(app).get(`${corporateBasePath}/health`).set('Authorization', 'Bearer ').expect(401),
      request(app).get(`${corporateBasePath}/health`).set('Authorization', 'Bearer incorrect-synthetic-token').expect(401),
      request(app).get(`${corporateBasePath}/health`).set('Authorization', `Basic ${targetToken}`).expect(401),
      request(app).get(`${corporateBasePath}/health?token=${targetToken}`).expect(401),
      request(app).get(`${corporateBasePath}/health`).send({ token: targetToken }).expect(401),
    ]);

    for (const response of responses) {
      expect(response.body).toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Corporate read-only authentication failed.',
      });
      expectSanitized(response.body);
    }
  });

  it('fails closed when the inbound gate is disabled or the target secret is invalid', async () => {
    const disabled = await authenticated(request(targetApp({ enabled: false, token: targetToken }))
      .get(`${corporateBasePath}/health`)).expect(503);
    const invalidConfigs: CorporateReadonlyTargetConfig[] = [
      { enabled: true },
      { enabled: true, token: 'short' },
      { enabled: true, token: 'invalid token with spaces' },
      { enabled: true, token: 'x'.repeat(4097) },
    ];
    const invalid = await Promise.all(invalidConfigs.map((config) => request(targetApp(config))
      .get(`${corporateBasePath}/health`)
      .set('Authorization', `Bearer ${targetToken}`)
      .expect(503)));

    for (const response of [disabled, ...invalid]) {
      expect(response.body).toMatchObject({
        status: 503,
        code: 'CORPORATE_READONLY_TARGET_UNAVAILABLE',
        message: 'Corporate read-only target is unavailable.',
      });
      expectSanitized(response.body);
    }
  });

  it('returns only the strict authenticated health contract', async () => {
    const response = await authenticated(request(targetApp()).get(`${corporateBasePath}/health`))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'orchestra-backend',
      timestamp: expect.any(String),
      requestId: expect.stringMatching(/^req_/),
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    expectSanitized(response.body);
  });

  it.each([
    ['/status', 'Orchestra operational'],
    ['/status/availability', 'Orchestra availability endpoint operational'],
  ])('returns only the strict authenticated status contract for %s', async (path, summary) => {
    const response = await authenticated(request(targetApp()).get(`${corporateBasePath}${path}`))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      summary,
      updatedAt: fixedUpdatedAt,
    });
    expectSanitized(response.body);
  });

  it('rejects arbitrary query or body input even with the correct Bearer', async () => {
    const queryResponse = await authenticated(request(targetApp()).get(`${corporateBasePath}/status?scope=other`))
      .expect(400);
    const bodyResponse = await authenticated(request(targetApp()).get(`${corporateBasePath}/status`).send({ scope: 'other' }))
      .expect(400);
    expectSanitized(queryResponse.body);
    expectSanitized(bodyResponse.body);
  });

  it('sanitizes malformed JSON before logging or returning a public error', async () => {
    const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    try {
      const response = await authenticated(request(targetApp()).get(`${corporateBasePath}/health`))
        .set('Content-Type', 'application/json')
        .send(`{"credential":"${sensitiveMarker}"`)
        .expect(400);

      expect(response.body).toEqual({
        status: 400,
        code: 'INVALID_JSON',
        message: 'JSON inválido.',
        requestId: expect.stringMatching(/^req_/),
      });
      expect(JSON.stringify(response.body)).not.toContain(sensitiveMarker);
      expect(response.body).not.toHaveProperty('details');
      expect(loggerWarn).toHaveBeenCalledOnce();
      expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(sensitiveMarker);
      expect(loggerWarn).toHaveBeenCalledWith({
        error: {
          type: 'entity.parse.failed',
          status: 400,
        },
        requestId: response.body.requestId,
      }, 'Invalid JSON request');
    } finally {
      loggerWarn.mockRestore();
    }
  });

  it('replaces caller request IDs throughout the corporate boundary', async () => {
    const app = targetApp();
    const boundaryRoot = await request(app)
      .get(corporateBasePath)
      .set('x-request-id', sensitiveMarker)
      .expect(404);
    const unauthorized = await request(app)
      .get(`${corporateBasePath}/health`)
      .set('x-request-id', sensitiveMarker)
      .expect(401);
    const health = await authenticated(request(app).get(`${corporateBasePath}/health`))
      .set('x-request-id', sensitiveMarker)
      .expect(200);
    const caseVariant = await authenticated(request(app).get('/V1/CORPORATE-READONLY/health'))
      .set('x-request-id', sensitiveMarker)
      .expect(200);

    for (const response of [boundaryRoot, unauthorized, health, caseVariant]) {
      expect(response.headers['x-request-id']).toMatch(/^req_/);
      expect(response.headers['x-request-id']).not.toBe(sensitiveMarker);
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
      expect(JSON.stringify(response.body)).not.toContain(sensitiveMarker);
    }
  });

  it('preserves caller request IDs outside the corporate boundary', async () => {
    const publicRequestId = 'req_public_compatibility_18f';
    const response = await request(targetApp())
      .get('/health')
      .set('x-request-id', publicRequestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(publicRequestId);
    expect(response.body.requestId).toBe(publicRequestId);
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'does not expose %s on any corporate target path',
    async (method) => {
      const app = targetApp();
      for (const path of ['/health', '/status', '/status/availability']) {
        await authenticated(request(app)[method](`${corporateBasePath}${path}`)).expect(404);
      }
    },
  );

  it('preserves the public health and status endpoints without Authorization', async () => {
    const app = targetApp();
    const health = await request(app).get('/health').expect(200);
    const status = await request(app).get('/v1/status').expect(200);
    const availability = await request(app).get('/v1/status/availability').expect(200);

    expect(health.body).toMatchObject({ status: 'ok', service: 'orchestra-backend' });
    expect(status.body).toEqual({
      status: 'ok',
      summary: 'Orchestra operational',
      updatedAt: fixedUpdatedAt,
    });
    expect(availability.body).toEqual({
      status: 'ok',
      summary: 'Orchestra availability endpoint operational',
      updatedAt: fixedUpdatedAt,
    });
  });
});
