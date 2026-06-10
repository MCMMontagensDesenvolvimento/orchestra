import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const assistantsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'status', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  workspaceId: z.string().uuid().optional(),
});

export const assistantCreateSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  version: z
    .object({
      displayName: z.string().trim().min(2).max(120).default('Initial draft'),
      instructions: z.string().trim().max(10000).optional(),
      modelProvider: z.string().trim().max(80).optional(),
      modelName: z.string().trim().max(120).optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
});

export const assistantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const assistantVersionCreateSchema = z.object({
  version: z.string().trim().min(1).max(40).optional(),
  displayName: z.string().trim().min(2).max(120),
  instructions: z.string().trim().max(10000).optional(),
  modelProvider: z.string().trim().max(80).optional(),
  modelName: z.string().trim().max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const assistantVersionParamsSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const assistantShareCreateSchema = z.object({
  shareType: z.enum(['workspace', 'user', 'tenant']),
  targetId: z.string().uuid().nullable().optional(),
});

export const assistantShareParamsSchema = z.object({
  id: z.string().uuid(),
  shareId: z.string().uuid(),
});

export type AssistantsQuery = z.infer<typeof assistantsQuerySchema>;
export type AssistantCreateInput = z.infer<typeof assistantCreateSchema>;
export type AssistantUpdateInput = z.infer<typeof assistantUpdateSchema>;
export type AssistantVersionCreateInput = z.infer<typeof assistantVersionCreateSchema>;
export type AssistantShareCreateInput = z.infer<typeof assistantShareCreateSchema>;
