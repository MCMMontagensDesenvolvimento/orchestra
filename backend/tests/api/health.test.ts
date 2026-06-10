import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app/app';

describe('health endpoints', () => {
  it('returns basic health', async () => {
    const app = createApp();
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.requestId).toMatch(/^req_/);
  });

  it('returns db health through injectable dependency', async () => {
    const app = createApp({ dbHealthCheck: async () => undefined });
    const response = await request(app).get('/health/db').expect(200);

    expect(response.body.database).toBe('reachable');
  });
});
