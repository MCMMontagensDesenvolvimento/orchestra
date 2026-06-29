import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import type {
  AiObservabilityAlertAggregationInput,
  AiObservabilityAlertMetric,
  AiObservabilityAlertRule,
  AiObservabilityAlertsRepository,
  EvaluateAiObservabilityAlertsInput,
} from './ai-observability-alerts.types';

function scopeFilters(input: EvaluateAiObservabilityAlertsInput): Prisma.AiObservabilityAlertRuleWhereInput[] {
  const filters: Prisma.AiObservabilityAlertRuleWhereInput[] = [
    { scopeType: 'tenant', workspaceId: null, assistantId: null, userId: null },
  ];
  if (input.workspaceId) filters.push({ scopeType: 'workspace', workspaceId: input.workspaceId });
  if (input.assistantId) filters.push({ scopeType: 'assistant', assistantId: input.assistantId });
  if (input.userId) filters.push({ scopeType: 'user', userId: input.userId });
  return filters;
}

function mapRule(rule: Awaited<ReturnType<typeof prisma.aiObservabilityAlertRule.findMany>>[number]): AiObservabilityAlertRule {
  return {
    id: rule.id,
    tenantId: rule.tenantId,
    workspaceId: rule.workspaceId,
    assistantId: rule.assistantId,
    userId: rule.userId,
    scopeType: rule.scopeType as AiObservabilityAlertRule['scopeType'],
    metric: rule.metric as AiObservabilityAlertRule['metric'],
    period: rule.period as AiObservabilityAlertRule['period'],
    operator: rule.operator as AiObservabilityAlertRule['operator'],
    thresholdValue: rule.thresholdValue,
    severity: rule.severity as AiObservabilityAlertRule['severity'],
    status: rule.status as AiObservabilityAlertRule['status'],
    source: rule.source,
    operation: rule.operation,
    provider: rule.provider,
    modelName: rule.modelName,
    cooldownMinutes: rule.cooldownMinutes,
    deletedAt: rule.deletedAt,
  };
}

function metricSql(metric: AiObservabilityAlertMetric) {
  if (metric === 'event_count') return Prisma.raw('COUNT(*)');
  if (metric === 'run_count') return Prisma.raw('COUNT(DISTINCT "run_id")');
  if (metric === 'failed_run_count') {
    return Prisma.raw('COUNT(DISTINCT "run_id") FILTER (WHERE "status" = \'failed\')');
  }
  if (metric === 'blocked_run_count') {
    return Prisma.raw('COUNT(DISTINCT "run_id") FILTER (WHERE "status" = \'blocked\')');
  }
  if (metric === 'avg_latency_ms') {
    return Prisma.raw('COALESCE(ROUND(AVG("latency_ms"))::bigint, 0)');
  }

  type SummedMetric = Exclude<
    AiObservabilityAlertMetric,
    'event_count' | 'run_count' | 'failed_run_count' | 'blocked_run_count' | 'avg_latency_ms'
  >;
  const columns: Record<SummedMetric, string> = {
    total_tokens: 'total_tokens',
    input_tokens: 'input_tokens',
    output_tokens: 'output_tokens',
    embedding_tokens: 'embedding_tokens',
    cached_tokens: 'cached_tokens',
    estimated_cost_minor_units: 'estimated_cost_minor_units',
  };
  return Prisma.raw(`COALESCE(SUM("${columns[metric as SummedMetric]}"), 0)`);
}

function aggregateConditions(input: AiObservabilityAlertAggregationInput) {
  const { rule } = input;
  const conditions = [
    Prisma.sql`"tenant_id" = ${rule.tenantId}::uuid`,
    Prisma.sql`"started_at" >= ${input.windowStart}`,
    Prisma.sql`"started_at" < ${input.windowEnd}`,
  ];

  if (rule.scopeType === 'workspace') conditions.push(Prisma.sql`"workspace_id" = ${rule.workspaceId}::uuid`);
  if (rule.scopeType === 'assistant') conditions.push(Prisma.sql`"assistant_id" = ${rule.assistantId}::uuid`);
  if (rule.scopeType === 'user') conditions.push(Prisma.sql`"user_id" = ${rule.userId}::uuid`);
  if (rule.source !== null) conditions.push(Prisma.sql`"source" = ${rule.source}`);
  if (rule.operation !== null) conditions.push(Prisma.sql`"operation" = ${rule.operation}`);
  if (rule.provider !== null) conditions.push(Prisma.sql`"provider" = ${rule.provider}`);
  if (rule.modelName !== null) conditions.push(Prisma.sql`"model" = ${rule.modelName}`);

  return conditions;
}

export const aiObservabilityAlertsRepository: AiObservabilityAlertsRepository = {
  async listApplicableRules(input) {
    const rules = await prisma.aiObservabilityAlertRule.findMany({
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
    return rules.map(mapRule);
  },

  async aggregateUsage(input) {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>(Prisma.sql`
      SELECT (${metricSql(input.rule.metric)})::text AS "value"
      FROM "ai_run_usage_events"
      WHERE ${Prisma.join(aggregateConditions(input), ' AND ')}
    `);
    return BigInt(rows[0]?.value ?? '0');
  },
};
