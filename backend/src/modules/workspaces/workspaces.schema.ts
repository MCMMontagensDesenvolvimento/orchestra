import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const workspacesQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'slug', 'status', 'createdAt', 'updatedAt']).default('name'),
});

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type WorkspacesQuery = z.infer<typeof workspacesQuerySchema>;
export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
