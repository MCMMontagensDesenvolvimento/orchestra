/**
 * Camada de mocks centralizada.
 * Re-exporta os datasets em `src/data/mockData.ts` para permitir migração
 * progressiva: futuramente os arrays podem ser movidos para cá (por domínio)
 * sem que os services precisem ser reescritos.
 */
export * from '@/data/mockData';
