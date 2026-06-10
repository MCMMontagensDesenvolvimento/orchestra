import { describe, expect, it } from 'vitest';
import { assistantsService } from '@/services/assistants.service';

describe('assistants service', () => {
  it('returns mock assistants when mocks are enabled by default', async () => {
    const assistants = await assistantsService.list();

    expect(assistants.length).toBeGreaterThan(0);
    expect(assistants[0].id).toBeTruthy();
  });
});
