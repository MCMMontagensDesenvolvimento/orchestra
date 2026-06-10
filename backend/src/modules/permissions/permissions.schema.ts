import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const permissionsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['key', 'createdAt', 'updatedAt']).default('key'),
});

export type PermissionsQuery = z.infer<typeof permissionsQuerySchema>;
