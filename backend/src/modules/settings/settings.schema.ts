import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const settingsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['key', 'createdAt', 'updatedAt']).default('key'),
  workspaceId: z.string().uuid().optional(),
});

export type SettingsQuery = z.infer<typeof settingsQuerySchema>;
