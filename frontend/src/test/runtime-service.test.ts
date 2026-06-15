import { describe, expect, it } from 'vitest';
import { runtimeService } from '@/services/runtime.service';

describe('runtime service', () => {
  it('returns mock local runtime health and sanitized config', async () => {
    const [health, config, providers] = await Promise.all([
      runtimeService.health(),
      runtimeService.config(),
      runtimeService.providers(),
    ]);

    expect(health.provider).toBe('local');
    expect(health.status).toBe('healthy');
    expect(config.agnoEnabled).toBe(false);
    expect(config.agnoExecutionEnabled).toBe(false);
    expect(JSON.stringify(config)).not.toContain('AGNO_API_KEY');
    expect(providers.some((provider) => provider.provider === 'agno_stub' && provider.health.status === 'disabled')).toBe(true);
    expect(providers.some((provider) => provider.provider === 'agno' && provider.health.status === 'disabled')).toBe(true);
  });
});
