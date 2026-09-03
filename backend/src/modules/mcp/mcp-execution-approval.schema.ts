import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const mcpExecutionApprovalStatusValues = [
  'pending',
  'approved',
  'claimed',
  'rejected',
  'cancelled',
  'expired',
  'consumed',
] as const;

export const mcpExecutionApprovalsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'expiresAt']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(mcpExecutionApprovalStatusValues).optional(),
  mcpToolId: z.string().uuid().optional(),
});

export const mcpExecutionApprovalCreateSchema = z.object({
  mcpToolId: z.string().uuid(),
  reason: z.string().trim().min(2).max(1000).optional(),
}).strict();

export const mcpExecutionApprovalDecisionSchema = z.object({
  decisionReason: z.string().trim().min(2).max(1000).optional(),
}).strict().default({});

export const mcpExecutionApprovalParamsSchema = z.object({
  id: z.string().uuid(),
  approvalId: z.string().uuid(),
});

export type McpExecutionApprovalsQuery = z.infer<typeof mcpExecutionApprovalsQuerySchema>;
export type McpExecutionApprovalCreateInput = z.infer<typeof mcpExecutionApprovalCreateSchema>;
export type McpExecutionApprovalDecisionInput = z.infer<typeof mcpExecutionApprovalDecisionSchema>;
export type McpExecutionApprovalStatus = typeof mcpExecutionApprovalStatusValues[number];
