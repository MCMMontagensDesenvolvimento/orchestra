import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().default(''),
  sortBy: z.string().trim().optional(),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function paginationMeta(query: Pick<PaginationQuery, 'page' | 'perPage'>, total: number): PaginationMeta {
  return {
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.ceil(total / query.perPage),
  };
}

export function paginationOffset(query: Pick<PaginationQuery, 'page' | 'perPage'>) {
  return {
    skip: (query.page - 1) * query.perPage,
    take: query.perPage,
  };
}
