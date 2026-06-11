import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const agentRunStatusValues = ['queued', 'prechecking', 'blocked', 'running', 'completed', 'failed', 'cancelled'] as const;
export const agentRunModeValues = ['draft_test', 'sandbox', 'published', 'blocked', 'archived'] as const;

export const createAgentRunSchema = z.object({
  mode: z.enum(agentRunModeValues).default('sandbox'),
  input: z.string().trim().min(1).max(2000),
  source: z.string().trim().min(1).max(80).default('api'),
  metadata: z.record(z.unknown()).optional(),
});

export const agentRunsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'mode']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  assistantId: z.string().uuid().optional(),
  status: z.enum(agentRunStatusValues).optional(),
  mode: z.enum(agentRunModeValues).optional(),
});

export const assistantRunParamsSchema = z.object({
  id: z.string().uuid(),
});

export const agentRunParamsSchema = z.object({
  runId: z.string().uuid(),
});

export type CreateAgentRunInput = z.infer<typeof createAgentRunSchema>;
export type AgentRunsQuery = z.infer<typeof agentRunsQuerySchema>;
export type AgentRunMode = z.infer<typeof createAgentRunSchema>['mode'];
export type AgentRunStatus = typeof agentRunStatusValues[number];
