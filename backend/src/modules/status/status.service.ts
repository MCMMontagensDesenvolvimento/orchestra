import { operationalStatusSchema, type OperationalStatus } from './status.schema';

export interface StatusServiceDependencies {
  now?: () => Date;
}

function buildOperationalStatus(
  summary: string,
  dependencies: StatusServiceDependencies = {},
): OperationalStatus {
  return operationalStatusSchema.parse({
    status: 'ok',
    summary,
    updatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
  });
}

export const statusService = {
  read(dependencies: StatusServiceDependencies = {}) {
    return buildOperationalStatus('Orchestra operational', dependencies);
  },

  readAvailability(dependencies: StatusServiceDependencies = {}) {
    return buildOperationalStatus(
      'Orchestra availability endpoint operational',
      dependencies,
    );
  },
};
