import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app/app';

describe('structured errors', () => {
  it('returns structured 404 with requestId', async () => {
    const response = await request(createApp())
      .get('/missing-route')
      .set('x-request-id', 'req_test_404')
      .expect(404);

    expect(response.body).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Rota nao encontrada.',
      requestId: 'req_test_404',
    });
  });
});
