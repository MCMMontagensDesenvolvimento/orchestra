import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  AiObservabilityAlertRulesQuery,
  AiUsageEventsQuery,
  AiUsageLimitPoliciesQuery,
  AiUsageSummaryGroupBy,
  AiUsageSummaryQuery,
} from './ai-observability-admin.schema';

type AiObservabilityAdminPrisma = Pick<
  PrismaClient,
  'aiRunUsageEvent' | 'aiUsageLimitPolicy' | 'aiObservabilityAlertRule' | 'assistant' | 'user' | '$queryRaw'
>;

const usageEventListSelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  userId: true,
  runId: true,
  traceId: true,
  source: true,
  operation: true,
  provider: true,
  modelName: true,
  status: true,
  blockedReason: true,
  errorCode: true,
  inputTokens: true,
  outputTokens: true,
  totalTokens: true,
  embeddingTokens: true,
  cachedTokens: true,
  latencyMs: true,
  costCurrency: true,
  estimatedCostMinorUnits: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
} satisfies Prisma.AiRunUsageEventSelect;

const usageEventDetailSelect = {
  ...usageEventListSelect,
  metadata: true,
} satisfies Prisma.AiRunUsageEventSelect;

const limitPolicySelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  userId: true,
  scopeType: true,
  metric: true,
  period: true,
  mode: true,
  status: true,
  limitValue: true,
  warnThresholdValue: true,
  source: true,
  operation: true,
  provider: true,
  modelName: true,
  description: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.AiUsageLimitPolicySelect;

const alertRuleListSelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  userId: true,
  scopeType: true,
  metric: true,
  period: true,
  operator: true,
  thresholdValue: true,
  severity: true,
  status: true,
  source: true,
  operation: true,
  provider: true,
  modelName: true,
  description: true,
  cooldownMinutes: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.AiObservabilityAlertRuleSelect;

const alertRuleDetailSelect = {
  ...alertRuleListSelect,
  metadata: true,
} satisfies Prisma.AiObservabilityAlertRuleSelect;

export type AiUsageEventListRecord = Prisma.AiRunUsageEventGetPayload<{
  select: typeof usageEventListSelect;
}>;
export type AiUsageEventDetailRecord = Prisma.AiRunUsageEventGetPayload<{
  select: typeof usageEventDetailSelect;
}>;
export type AiUsageLimitPolicyRecord = Prisma.AiUsageLimitPolicyGetPayload<{
  select: typeof limitPolicySelect;
}>;
export type AiObservabilityAlertRuleListRecord = Prisma.AiObservabilityAlertRuleGetPayload<{
  select: typeof alertRuleListSelect;
}>;
export type AiObservabilityAlertRuleDetailRecord = Prisma.AiObservabilityAlertRuleGetPayload<{
  select: typeof alertRuleDetailSelect;
}>;

export interface AiUsageSummaryRecord {
  groupKey: string | null;
  eventCount: string;
  runCount: string;
  inputTokens: string;
  outputTokens: string;
  totalTokens: string;
  embeddingTokens: string;
  cachedTokens: string;
  estimatedCostMinorUnits: string;
  avgLatencyMs: number | null;
  failedRunCount: string;
  blockedRunCount: string;
}

function workspaceWhere(queryWorkspaceId: string | undefined, workspaceIds: string[]) {
  return queryWorkspaceId ?? { in: workspaceIds };
}

function usageEventsWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiUsageEventsQuery,
): Prisma.AiRunUsageEventWhereInput {
  return {
    tenantId,
    workspaceId: workspaceWhere(query.workspaceId, workspaceIds),
    ...(query.assistantId ? { assistantId: query.assistantId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.runId ? { runId: query.runId } : {}),
    ...(query.traceId ? { traceId: query.traceId } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.operation ? { operation: query.operation } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.model ? { modelName: query.model } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.startedAtFrom || query.startedAtTo
      ? {
          startedAt: {
            ...(query.startedAtFrom ? { gte: query.startedAtFrom } : {}),
            ...(query.startedAtTo ? { lte: query.startedAtTo } : {}),
          },
        }
      : {}),
    ...(query.createdAtFrom || query.createdAtTo
      ? {
          createdAt: {
            ...(query.createdAtFrom ? { gte: query.createdAtFrom } : {}),
            ...(query.createdAtTo ? { lte: query.createdAtTo } : {}),
          },
        }
      : {}),
  };
}

function policyScopeWhere(
  tenantId: string,
  workspaceIds: string[],
): Prisma.AiUsageLimitPolicyWhereInput {
  return {
    OR: [
      { scopeType: 'tenant' },
      { scopeType: 'workspace', workspaceId: { in: workspaceIds } },
      {
        scopeType: 'assistant',
        assistant: { is: { tenantId, workspaceId: { in: workspaceIds } } },
      },
      {
        scopeType: 'user',
        user: {
          is: {
            tenantId,
            memberships: { some: { workspaceId: { in: workspaceIds } } },
          },
        },
      },
    ],
  };
}

function policiesWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiUsageLimitPoliciesQuery,
): Prisma.AiUsageLimitPolicyWhereInput {
  const visibleWorkspaceIds = query.workspaceId ? [query.workspaceId] : workspaceIds;
  return {
    tenantId,
    AND: [policyScopeWhere(tenantId, visibleWorkspaceIds)],
    ...(query.assistantId ? { assistantId: query.assistantId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.scopeType ? { scopeType: query.scopeType } : {}),
    ...(query.metric ? { metric: query.metric } : {}),
    ...(query.period ? { period: query.period } : {}),
    ...(query.mode ? { mode: query.mode } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.operation ? { operation: query.operation } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.model ? { modelName: query.model } : {}),
    ...(!query.includeDeleted ? { deletedAt: null } : {}),
  };
}

function alertRuleScopeWhere(
  tenantId: string,
  workspaceIds: string[],
): Prisma.AiObservabilityAlertRuleWhereInput {
  return {
    OR: [
      { scopeType: 'tenant' },
      { scopeType: 'workspace', workspaceId: { in: workspaceIds } },
      {
        scopeType: 'assistant',
        assistant: { is: { tenantId, workspaceId: { in: workspaceIds } } },
      },
      {
        scopeType: 'user',
        user: {
          is: {
            tenantId,
            memberships: { some: { workspaceId: { in: workspaceIds } } },
          },
        },
      },
    ],
  };
}

function alertRulesWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiObservabilityAlertRulesQuery,
): Prisma.AiObservabilityAlertRuleWhereInput {
  const visibleWorkspaceIds = query.workspaceId ? [query.workspaceId] : workspaceIds;
  return {
    tenantId,
    AND: [alertRuleScopeWhere(tenantId, visibleWorkspaceIds)],
    ...(query.assistantId ? { assistantId: query.assistantId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.scopeType ? { scopeType: query.scopeType } : {}),
    ...(query.metric ? { metric: query.metric } : {}),
    ...(query.period ? { period: query.period } : {}),
    ...(query.operator ? { operator: query.operator } : {}),
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.operation ? { operation: query.operation } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.model ? { modelName: query.model } : {}),
    ...(!query.includeDeleted ? { deletedAt: null } : {}),
  };
}

function uuidList(values: string[]) {
  return Prisma.join(values.map((value) => Prisma.sql`${value}::uuid`));
}

function summaryConditions(
  tenantId: string,
  workspaceIds: string[],
  query: AiUsageSummaryQuery,
) {
  const visibleWorkspaceIds = query.workspaceId ? [query.workspaceId] : workspaceIds;
  const conditions: Prisma.Sql[] = [Prisma.sql`"tenant_id" = ${tenantId}::uuid`];
  conditions.push(visibleWorkspaceIds.length > 0
    ? Prisma.sql`"workspace_id" IN (${uuidList(visibleWorkspaceIds)})`
    : Prisma.sql`FALSE`);
  if (query.assistantId) conditions.push(Prisma.sql`"assistant_id" = ${query.assistantId}::uuid`);
  if (query.userId) conditions.push(Prisma.sql`"user_id" = ${query.userId}::uuid`);
  if (query.source) conditions.push(Prisma.sql`"source" = ${query.source}`);
  if (query.operation) conditions.push(Prisma.sql`"operation" = ${query.operation}`);
  if (query.provider) conditions.push(Prisma.sql`"provider" = ${query.provider}`);
  if (query.model) conditions.push(Prisma.sql`"model" = ${query.model}`);
  if (query.status) conditions.push(Prisma.sql`"status" = ${query.status}`);
  if (query.startedAtFrom) conditions.push(Prisma.sql`"started_at" >= ${query.startedAtFrom}`);
  if (query.startedAtTo) conditions.push(Prisma.sql`"started_at" <= ${query.startedAtTo}`);
  return conditions;
}

function summaryGroupExpression(groupBy: AiUsageSummaryGroupBy) {
  const expressions: Record<AiUsageSummaryGroupBy, Prisma.Sql> = {
    none: Prisma.raw('NULL::text'),
    workspace: Prisma.raw('"workspace_id"::text'),
    assistant: Prisma.raw('"assistant_id"::text'),
    user: Prisma.raw('"user_id"::text'),
    source: Prisma.raw('"source"'),
    operation: Prisma.raw('"operation"'),
    provider: Prisma.raw('"provider"'),
    model: Prisma.raw('"model"'),
    status: Prisma.raw('"status"'),
    day: Prisma.raw(`to_char(date_trunc('day', "started_at"), 'YYYY-MM-DD')`),
    month: Prisma.raw(`to_char(date_trunc('month', "started_at"), 'YYYY-MM')`),
  };
  return expressions[groupBy];
}

export class AiObservabilityAdminPersistenceRepository {
  constructor(private readonly db: AiObservabilityAdminPrisma = defaultPrisma) {}

  async listUsageEvents(tenantId: string, workspaceIds: string[], query: AiUsageEventsQuery) {
    const where = usageEventsWhere(tenantId, workspaceIds, query);
    const [sortBy, sortDirection] = query.sort.split(':') as [
      'startedAt' | 'createdAt',
      'asc' | 'desc',
    ];
    const orderBy = { [sortBy]: sortDirection } satisfies Prisma.AiRunUsageEventOrderByWithRelationInput;
    const [data, total] = await Promise.all([
      this.db.aiRunUsageEvent.findMany({
        where,
        select: usageEventListSelect,
        orderBy,
        ...paginationOffset(query),
      }),
      this.db.aiRunUsageEvent.count({ where }),
    ]);
    return { data, total };
  }

  findUsageEvent(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.aiRunUsageEvent.findFirst({
      where: { id, tenantId, workspaceId: { in: workspaceIds } },
      select: usageEventDetailSelect,
    });
  }

  summarizeUsage(tenantId: string, workspaceIds: string[], query: AiUsageSummaryQuery) {
    const groupExpression = summaryGroupExpression(query.groupBy);
    const groupClause = query.groupBy === 'none'
      ? Prisma.empty
      : Prisma.sql`GROUP BY ${groupExpression} ORDER BY ${groupExpression} ASC NULLS LAST`;
    return this.db.$queryRaw<AiUsageSummaryRecord[]>(Prisma.sql`
      SELECT
        ${groupExpression} AS "groupKey",
        COUNT(*)::text AS "eventCount",
        COUNT(DISTINCT "run_id")::text AS "runCount",
        COALESCE(SUM("input_tokens"), 0)::text AS "inputTokens",
        COALESCE(SUM("output_tokens"), 0)::text AS "outputTokens",
        COALESCE(SUM("total_tokens"), 0)::text AS "totalTokens",
        COALESCE(SUM("embedding_tokens"), 0)::text AS "embeddingTokens",
        COALESCE(SUM("cached_tokens"), 0)::text AS "cachedTokens",
        COALESCE(SUM("estimated_cost_minor_units"), 0)::text AS "estimatedCostMinorUnits",
        AVG("latency_ms")::double precision AS "avgLatencyMs",
        (COUNT(DISTINCT "run_id") FILTER (WHERE "status" = 'failed'))::text AS "failedRunCount",
        (COUNT(DISTINCT "run_id") FILTER (WHERE "status" = 'blocked'))::text AS "blockedRunCount"
      FROM "ai_run_usage_events"
      WHERE ${Prisma.join(summaryConditions(tenantId, workspaceIds, query), ' AND ')}
      ${groupClause}
    `);
  }

  async listLimitPolicies(
    tenantId: string,
    workspaceIds: string[],
    query: AiUsageLimitPoliciesQuery,
  ) {
    const where = policiesWhere(tenantId, workspaceIds, query);
    const [sortBy, sortDirection] = query.sort.split(':') as [
      'createdAt' | 'updatedAt',
      'asc' | 'desc',
    ];
    const orderBy = { [sortBy]: sortDirection } satisfies Prisma.AiUsageLimitPolicyOrderByWithRelationInput;
    const [data, total] = await Promise.all([
      this.db.aiUsageLimitPolicy.findMany({
        where,
        select: limitPolicySelect,
        orderBy,
        ...paginationOffset(query),
      }),
      this.db.aiUsageLimitPolicy.count({ where }),
    ]);
    return { data, total };
  }

  findLimitPolicy(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.aiUsageLimitPolicy.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        AND: [policyScopeWhere(tenantId, workspaceIds)],
      },
      select: limitPolicySelect,
    });
  }

  async listAlertRules(
    tenantId: string,
    workspaceIds: string[],
    query: AiObservabilityAlertRulesQuery,
  ) {
    const where = alertRulesWhere(tenantId, workspaceIds, query);
    const [sortBy, sortDirection] = query.sort.split(':') as [
      'createdAt' | 'updatedAt',
      'asc' | 'desc',
    ];
    const orderBy = { [sortBy]: sortDirection } satisfies Prisma.AiObservabilityAlertRuleOrderByWithRelationInput;
    const [data, total] = await Promise.all([
      this.db.aiObservabilityAlertRule.findMany({
        where,
        select: alertRuleListSelect,
        orderBy,
        ...paginationOffset(query),
      }),
      this.db.aiObservabilityAlertRule.count({ where }),
    ]);
    return { data, total };
  }

  findAlertRule(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.aiObservabilityAlertRule.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        AND: [alertRuleScopeWhere(tenantId, workspaceIds)],
      },
      select: alertRuleDetailSelect,
    });
  }

  async isEvaluationContextAccessible(input: {
    tenantId: string;
    workspaceId: string;
    assistantId?: string | null;
    userId?: string | null;
  }) {
    const [assistant, user] = await Promise.all([
      input.assistantId
        ? this.db.assistant.findFirst({
            where: {
              id: input.assistantId,
              tenantId: input.tenantId,
              workspaceId: input.workspaceId,
              deletedAt: null,
            },
            select: { id: true },
          })
        : Promise.resolve({ id: 'not-required' }),
      input.userId
        ? this.db.user.findFirst({
            where: {
              id: input.userId,
              tenantId: input.tenantId,
              deletedAt: null,
              memberships: { some: { workspaceId: input.workspaceId } },
            },
            select: { id: true },
          })
        : Promise.resolve({ id: 'not-required' }),
    ]);
    return Boolean(assistant && user);
  }
}

export const aiObservabilityAdminRepository = new AiObservabilityAdminPersistenceRepository();
