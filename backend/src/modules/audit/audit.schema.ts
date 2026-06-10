import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const auditQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['createdAt', 'action', 'entity']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  action: z.string().trim().max(120).optional(),
  entity: z.string().trim().max(120).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
