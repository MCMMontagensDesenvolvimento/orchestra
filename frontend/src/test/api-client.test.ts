import { describe, expect, it } from 'vitest';
import { apiClient } from '@/services/api/api-client';
import { ApiError } from '@/services/api/api-error';

describe('api client', () => {
  it('sends browser credentials for HttpOnly cookie sessions', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it('preserves requestId and fieldErrors in ApiError', () => {
    const error = new ApiError(
      'Campos invalidos',
      422,
      'VALIDATION_ERROR',
      undefined,
      'req_test',
      [{ field: 'name', message: 'Obrigatorio' }],
    );

    expect(error.requestId).toBe('req_test');
    expect(error.fieldErrors?.[0].field).toBe('name');
  });
});
