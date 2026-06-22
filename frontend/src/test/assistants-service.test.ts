import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    appEnv: 'test',
    isProductionLike: false,
    useMocks: true,
    mockModeAllowed: true,
    mockModeBlockedReason: null,
    mockDelayMs: 0,
    mockScenario: 'success',
    apiBaseUrl: '/api/v1',
  },
}));

import { assistantsService } from '@/services/assistants.service';

describe('assistants service', () => {
  it('returns mock assistants when mocks are explicitly enabled for tests', async () => {
    const assistants = await assistantsService.list();

    expect(assistants.length).toBeGreaterThan(0);
    expect(assistants[0].id).toBeTruthy();
  });
});
