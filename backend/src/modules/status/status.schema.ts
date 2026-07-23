import { z } from 'zod';

export const operationalStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  summary: z.string().min(1).max(240),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export type OperationalStatus = z.infer<typeof operationalStatusSchema>;
