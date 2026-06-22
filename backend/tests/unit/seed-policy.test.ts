import { describe, expect, it } from 'vitest';
import {
  isDemoSeedRequested,
  isProductionLikeSeedEnvironment,
  resolveSeedEnvironment,
  resolveSeedPolicy,
} from '../../prisma/seed-policy';

describe('seed policy', () => {
  it('defaults to development bootstrap without demo data', () => {
    expect(resolveSeedEnvironment({})).toBe('development');
    expect(isDemoSeedRequested({}, [])).toBe(false);
    expect(resolveSeedPolicy({}, [])).toEqual({
      environment: 'development',
      demoRequested: false,
      productionLike: false,
    });
  });

  it('allows explicit demo seed in local-like environments', () => {
    expect(resolveSeedPolicy({ ORCHESTRA_ENV: 'local', ORCHESTRA_SEED_DEMO: 'true' }, [])).toEqual({
      environment: 'local',
      demoRequested: true,
      productionLike: false,
    });
    expect(resolveSeedPolicy({ NODE_ENV: 'development' }, ['--demo']).demoRequested).toBe(true);
    expect(resolveSeedPolicy({ APP_ENV: 'test', SEED_DEMO_DATA: 'true' }, []).demoRequested).toBe(true);
  });

  it.each(['production', 'prod', 'staging', 'homolog', 'homologation'])(
    'blocks demo seed in %s',
    (environment) => {
      expect(isProductionLikeSeedEnvironment(environment)).toBe(true);
      expect(() => resolveSeedPolicy({ ORCHESTRA_ENV: environment, ORCHESTRA_SEED_DEMO: 'true' }, [])).toThrow(
        `Demo seed is not allowed for environment "${environment}".`,
      );
    },
  );

  it('prioritizes ORCHESTRA_ENV over APP_ENV and NODE_ENV', () => {
    expect(resolveSeedEnvironment({
      ORCHESTRA_ENV: 'homolog',
      APP_ENV: 'local',
      NODE_ENV: 'development',
    })).toBe('homolog');
  });
});
