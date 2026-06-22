const productionLikeEnvironments = new Set(['production', 'prod', 'staging', 'homolog', 'homologation']);

const truthy = (value: string | undefined) => value?.trim().toLowerCase() === 'true';

export interface SeedPolicy {
  environment: string;
  demoRequested: boolean;
  productionLike: boolean;
}

export function resolveSeedEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return (source.ORCHESTRA_ENV ?? source.APP_ENV ?? source.NODE_ENV ?? 'development').trim().toLowerCase() || 'development';
}

export function isProductionLikeSeedEnvironment(environment: string) {
  return productionLikeEnvironments.has(environment.trim().toLowerCase());
}

export function isDemoSeedRequested(source: NodeJS.ProcessEnv = process.env, argv = process.argv.slice(2)) {
  return truthy(source.ORCHESTRA_SEED_DEMO) || truthy(source.SEED_DEMO_DATA) || argv.includes('--demo');
}

export function resolveSeedPolicy(source: NodeJS.ProcessEnv = process.env, argv = process.argv.slice(2)): SeedPolicy {
  const environment = resolveSeedEnvironment(source);
  const demoRequested = isDemoSeedRequested(source, argv);
  const productionLike = isProductionLikeSeedEnvironment(environment);

  if (demoRequested && productionLike) {
    throw new Error(`Demo seed is not allowed for environment "${environment}". Run bootstrap without demo data.`);
  }

  return {
    environment,
    demoRequested,
    productionLike,
  };
}
