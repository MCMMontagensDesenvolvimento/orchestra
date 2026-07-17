import { z } from 'zod';
import { agentRunStatusValues } from '../agent-runs/agent-runs.schema';

const optionalBooleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean().optional());

const runtimeRunFilters = {
  workspaceId: z.string().uuid().optional(),
  status: z.enum(agentRunStatusValues).optional(),
  runtimeProvider: z.string().trim().min(1).max(80).optional(),
  ragMode: z.string().trim().min(1).max(80).optional(),
  responseScopeMode: z.enum(['knowledge_only', 'knowledge_first', 'general_allowed']).optional(),
  fallbackOutsideKnowledgeUsed: optionalBooleanQuery,
  externalProviderCalled: optionalBooleanQuery,
  externalMcpCalled: optionalBooleanQuery,
  usageLimitBlocked: optionalBooleanQuery,
  search: z.string().trim().max(160).default(''),
};

export const runtimeRunsQuerySchema = z.object({
  ...runtimeRunFilters,
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type RuntimeRunsQuery = z.infer<typeof runtimeRunsQuerySchema>;
