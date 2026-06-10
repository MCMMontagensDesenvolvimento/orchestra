import { prisma } from '../../infrastructure/prisma/prisma.service';

export interface HealthServiceDependencies {
  dbHealthCheck?: () => Promise<void>;
}

export const healthService = {
  async check() {
    return {
      status: 'ok',
      service: 'orchestra-backend',
      timestamp: new Date().toISOString(),
    };
  },

  async checkDb(dependencies: HealthServiceDependencies = {}) {
    if (dependencies.dbHealthCheck) {
      await dependencies.dbHealthCheck();
    } else {
      await prisma.$queryRaw`SELECT 1`;
    }
    return {
      status: 'ok',
      database: 'reachable',
      timestamp: new Date().toISOString(),
    };
  },
};
