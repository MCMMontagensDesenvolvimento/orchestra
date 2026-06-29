import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import type {
  AiUsageAggregationInput,
  AiUsageLimitMetric,
  AiUsageLimitPolicy,
  AiUsageLimitsRepository,
  EvaluateAiUsageLimitsInput,
} from './ai-usage-limits.types';

function scopeFilters(input: EvaluateAiUsageLimitsInput): Prisma.AiUsageLimitPolicyWhereInput[] {
  const filters: Prisma.AiUsageLimitPolicyWhereInput[] = [
    { scopeType: 'tenant', workspaceId: null, assistantId: null, userId: null },
  ];
  if (input.workspaceId) filters.push({ scopeType: 'workspace', workspaceId: input.workspaceId });
  if (input.assistantId) filters.push({ scopeType: 'assistant', assistantId: input.assistantId });
  if (input.userId) filters.push({ scopeType: 'user', userId: input.userId });
  return filters;
}

function mapPolicy(policy: Awaited<ReturnType<typeof prisma.aiUsageLimitPolicy.findMany>>[number]): AiUsageLimitPolicy {
  return {
    id: policy.id,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    assistantId: policy.assistantId,
    userId: policy.userId,
    scopeType: policy.scopeType as AiUsageLimitPolicy['scopeType'],
    metric: policy.metric as AiUsageLimitPolicy['metric'],
    period: policy.period as AiUsageLimitPolicy['period'],
    mode: policy.mode as AiUsageLimitPolicy['mode'],
    status: policy.status as AiUsageLimitPolicy['status'],
    limitValue: policy.limitValue,
    warnThresholdValue: policy.warnThresholdValue,
    source: policy.source,
    operation: policy.operation,
    provider: policy.provider,
    modelName: policy.modelName,
    deletedAt: policy.deletedAt,
  };
}

function metricSql(metric: AiUsageLimitMetric) {
  if (metric === 'run_count') return Prisma.raw('COUNT(DISTINCT "run_id")');
  if (metric === 'failed_run_count') {
    return Prisma.raw('COUNT(DISTINCT "run_id") FILTER (WHERE "status" = \'failed\')');
  }
  if (metric === 'blocked_run_count') {
    return Prisma.raw('COUNT(DISTINCT "run_id") FILTER (WHERE "status" = \'blocked\')');
  }

  const columns: Record<Exclude<AiUsageLimitMetric, 'run_count' | 'failed_run_count' | 'blocked_run_count'>, string> = {
    total_tokens: 'total_tokens',
    input_tokens: 'input_tokens',
    output_tokens: 'output_tokens',
    embedding_tokens: 'embedding_tokens',
    cached_tokens: 'cached_tokens',
    estimated_cost_minor_units: 'estimated_cost_minor_units',
  };
  return Prisma.raw(`COALESCE(SUM("${columns[metric]}"), 0)`);
}

function aggregateConditions(input: AiUsageAggregationInput) {
  const { policy } = input;
  const conditions = [
    Prisma.sql`"tenant_id" = ${policy.tenantId}::uuid`,
    Prisma.sql`"started_at" >= ${input.windowStart}`,
    Prisma.sql`"started_at" < ${input.windowEnd}`,
  ];

  if (policy.scopeType === 'workspace') conditions.push(Prisma.sql`"workspace_id" = ${policy.workspaceId}::uuid`);
  if (policy.scopeType === 'assistant') conditions.push(Prisma.sql`"assistant_id" = ${policy.assistantId}::uuid`);
  if (policy.scopeType === 'user') conditions.push(Prisma.sql`"user_id" = ${policy.userId}::uuid`);
  if (policy.source !== null) conditions.push(Prisma.sql`"source" = ${policy.source}`);
  if (policy.operation !== null) conditions.push(Prisma.sql`"operation" = ${policy.operation}`);
  if (policy.provider !== null) conditions.push(Prisma.sql`"provider" = ${policy.provider}`);
  if (policy.modelName !== null) conditions.push(Prisma.sql`"model" = ${policy.modelName}`);

  return conditions;
}

export const aiUsageLimitsRepository: AiUsageLimitsRepository = {
  async listApplicablePolicies(input) {
    const policies = await prisma.aiUsageLimitPolicy.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'active',
        deletedAt: null,
        OR: scopeFilters(input),
        AND: [
          { OR: [{ source: null }, ...(input.source ? [{ source: input.source }] : [])] },
          { OR: [{ operation: null }, ...(input.operation ? [{ operation: input.operation }] : [])] },
          { OR: [{ provider: null }, ...(input.provider ? [{ provider: input.provider }] : [])] },
          { OR: [{ modelName: null }, ...(input.model ? [{ modelName: input.model }] : [])] },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    return policies.map(mapPolicy);
  },

  async aggregateUsage(input) {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>(Prisma.sql`
      SELECT (${metricSql(input.policy.metric)})::text AS "value"
      FROM "ai_run_usage_events"
      WHERE ${Prisma.join(aggregateConditions(input), ' AND ')}
    `);
    return BigInt(rows[0]?.value ?? '0');
  },
};
