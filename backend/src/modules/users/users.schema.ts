import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const usersQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'email', 'status', 'lastLoginAt', 'createdAt', 'updatedAt']).default('name'),
});

export const userCreateSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2).max(120),
  status: z.enum(['active', 'inactive']).default('active'),
  roleId: z.string().uuid().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  roleId: z.string().uuid().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');

export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
