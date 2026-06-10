import { z } from 'zod';

export const devLoginSchema = z.object({
  email: z.string().email().optional(),
});

export type DevLoginInput = z.infer<typeof devLoginSchema>;
