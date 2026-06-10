import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const rolesQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2).max(80).regex(/^[a-z0-9_.-]+$/),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).regex(/^[a-z0-9_.-]+$/).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const rolePermissionParamsSchema = z.object({
  id: z.string().uuid(),
  permissionId: z.string().uuid(),
});

export type RolesQuery = z.infer<typeof rolesQuerySchema>;
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
