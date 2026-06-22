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

import { llmService } from '@/services/llm.service';

describe('llm service', () => {
  it('returns mock llm providers with external execution disabled by default', async () => {
    const [providers, config] = await Promise.all([
      llmService.providers(),
      llmService.config(),
    ]);

    expect(config.defaultProvider).toBe('local_deterministic');
    expect(config.providersEnabled).toBe(false);
    expect(config.executionEnabled).toBe(false);
    expect(providers.find((provider) => provider.provider === 'local_deterministic')?.health.status).toBe('healthy');
    expect(providers.find((provider) => provider.provider === 'openai')?.health.status).toBe('disabled');
    expect(JSON.stringify(config)).not.toContain('OPENAI_API_KEY');
    expect(JSON.stringify(config)).not.toContain('https://api.openai.com');
  });
});
