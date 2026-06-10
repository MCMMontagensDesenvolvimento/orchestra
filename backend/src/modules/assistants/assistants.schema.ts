import { z } from 'zod';

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

export type AssistantCreateInput = z.infer<typeof assistantCreateSchema>;
export type AssistantUpdateInput = z.infer<typeof assistantUpdateSchema>;
