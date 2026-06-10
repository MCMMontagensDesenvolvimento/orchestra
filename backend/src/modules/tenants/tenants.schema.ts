import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const tenantsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'slug', 'status', 'createdAt', 'updatedAt']).default('name'),
});

export const tenantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type TenantsQuery = z.infer<typeof tenantsQuerySchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
