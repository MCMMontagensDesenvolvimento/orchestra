import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { RuntimeRunsQuery } from './runtime-observability.schema';

type RuntimeObservabilityPrisma = Pick<
  PrismaClient,
  'agentRun' | 'aiRunUsageEvent' | 'ragQuery'
>;

const runtimeRunListSelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  assistantVersionId: true,
  status: true,
  mode: true,
  inputSummary: true,
  requestId: true,
  traceId: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  cancelledAt: true,
  blockedAt: true,
  metadata: true,
  createdAt: true,
  assistant: {
    select: {
      name: true,
    },
  },
  assistantVersion: {
    select: {
      version: true,
      displayName: true,
      modelProvider: true,
      modelName: true,
    },
  },
} satisfies Prisma.AgentRunSelect;

const runtimeRunDetailSelect = {
  ...runtimeRunListSelect,
  events: {
    orderBy: { sequence: 'asc' as const },
    take: 100,
    select: {
      id: true,
      type: true,
      sequence: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
  },
} satisfies Prisma.AgentRunSelect;

const runtimeUsageSelect = {
  provider: true,
  modelName: true,
  inputTokens: true,
  outputTokens: true,
  totalTokens: true,
  latencyMs: true,
  costCurrency: true,
  estimatedCostMinorUnits: true,
  startedAt: true,
} satisfies Prisma.AiRunUsageEventSelect;

const runtimeRagQuerySelect = {
  id: true,
  mode: true,
  status: true,
  resultCount: true,
  createdAt: true,
  results: {
    orderBy: { rank: 'asc' as const },
    take: 20,
    select: {
      rank: true,
      score: true,
      matchType: true,
      excerpt: true,
      citationLabel: true,
      metadata: true,
      document: {
        select: { title: true },
      },
      sourceReference: {
        select: { label: true },
      },
    },
  },
} satisfies Prisma.RagQuerySelect;

export type RuntimeRunListRecord = Prisma.AgentRunGetPayload<{
  select: typeof runtimeRunListSelect;
}>;
export type RuntimeRunDetailRecord = Prisma.AgentRunGetPayload<{
  select: typeof runtimeRunDetailSelect;
}>;
export type RuntimeUsageRecord = Prisma.AiRunUsageEventGetPayload<{
  select: typeof runtimeUsageSelect;
}>;
export type RuntimeRagQueryRecord = Prisma.RagQueryGetPayload<{
  select: typeof runtimeRagQuerySelect;
}>;

export interface RuntimeRunListRow {
  run: RuntimeRunListRecord;
  usage: RuntimeUsageRecord | null;
}

export interface RuntimeRunDetailRow {
  run: RuntimeRunDetailRecord;
  usage: RuntimeUsageRecord | null;
  ragQueries: RuntimeRagQueryRecord[];
}

function metadataEquals(path: string[], equals: string | boolean): Prisma.AgentRunWhereInput {
  return { metadata: { path, equals } };
}

function runtimeRunsWhere(
  tenantId: string,
  workspaceIds: string[],
  query: RuntimeRunsQuery,
): Prisma.AgentRunWhereInput {
  const and: Prisma.AgentRunWhereInput[] = [];
  if (query.runtimeProvider) and.push(metadataEquals(['runtime', 'provider'], query.runtimeProvider));
  if (query.ragMode) and.push(metadataEquals(['runtime', 'ragMode'], query.ragMode));
  if (query.responseScopeMode) and.push(metadataEquals(['runtime', 'responseScopeMode'], query.responseScopeMode));
  if (query.fallbackOutsideKnowledgeUsed !== undefined) {
    and.push(metadataEquals(['runtime', 'fallbackOutsideKnowledgeUsed'], query.fallbackOutsideKnowledgeUsed));
  }
  if (query.externalProviderCalled !== undefined) {
    and.push(metadataEquals(['runtime', 'externalProviderCalled'], query.externalProviderCalled));
  }
  if (query.externalMcpCalled !== undefined) {
    and.push(metadataEquals(['runtime', 'externalMcpCalled'], query.externalMcpCalled));
  }

  return {
    tenantId,
    workspaceId: query.workspaceId ?? { in: workspaceIds },
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? { inputSummary: { contains: query.search, mode: 'insensitive' } }
      : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

function runtimeUsageWhere(tenantId: string, workspaceIds: string[]) {
  return {
    tenantId,
    workspaceId: { in: workspaceIds },
    source: 'runtime_adapter',
    operation: 'agent_run.runtime_execute',
  } satisfies Prisma.AiRunUsageEventWhereInput;
}

export class RuntimeObservabilityPersistenceRepository {
  constructor(private readonly db: RuntimeObservabilityPrisma = defaultPrisma) {}

  async listRuntimeRuns(tenantId: string, workspaceIds: string[], query: RuntimeRunsQuery) {
    const where = runtimeRunsWhere(tenantId, workspaceIds, query);
    const [runs, total] = await Promise.all([
      this.db.agentRun.findMany({
        where,
        select: runtimeRunListSelect,
        orderBy: { createdAt: 'desc' },
        ...paginationOffset(query),
      }),
      this.db.agentRun.count({ where }),
    ]);
    const usageEvents = runs.length
      ? await this.db.aiRunUsageEvent.findMany({
        where: {
          ...runtimeUsageWhere(tenantId, workspaceIds),
          runId: { in: runs.map((run) => run.id) },
        },
        select: { runId: true, ...runtimeUsageSelect },
        orderBy: { startedAt: 'desc' },
      })
      : [];
    const usageByRunId = new Map<string, RuntimeUsageRecord>();
    for (const event of usageEvents) {
      if (!usageByRunId.has(event.runId)) usageByRunId.set(event.runId, event);
    }
    return {
      data: runs.map((run) => ({ run, usage: usageByRunId.get(run.id) ?? null })),
      total,
    };
  }

  async findRuntimeRun(id: string, tenantId: string, workspaceIds: string[]): Promise<RuntimeRunDetailRow | null> {
    const run = await this.db.agentRun.findFirst({
      where: { id, tenantId, workspaceId: { in: workspaceIds } },
      select: runtimeRunDetailSelect,
    });
    if (!run) return null;

    const [usage, ragQueries] = await Promise.all([
      this.db.aiRunUsageEvent.findFirst({
        where: {
          ...runtimeUsageWhere(tenantId, workspaceIds),
          runId: id,
        },
        select: runtimeUsageSelect,
        orderBy: { startedAt: 'desc' },
      }),
      this.db.ragQuery.findMany({
        where: {
          agentRunId: id,
          tenantId,
          workspaceId: { in: workspaceIds },
        },
        select: runtimeRagQuerySelect,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return { run, usage, ragQueries };
  }

  async summarizeRuntime(tenantId: string, workspaceIds: string[]) {
    const runWhere = { tenantId, workspaceId: { in: workspaceIds } } satisfies Prisma.AgentRunWhereInput;
    const [totalRuns, statusGroups, usage] = await Promise.all([
      this.db.agentRun.count({ where: runWhere }),
      this.db.agentRun.groupBy({
        by: ['status'],
        where: runWhere,
        _count: { _all: true },
      }),
      this.db.aiRunUsageEvent.aggregate({
        where: runtimeUsageWhere(tenantId, workspaceIds),
        _sum: { totalTokens: true },
        _avg: { latencyMs: true },
      }),
    ]);
    return { totalRuns, statusGroups, usage };
  }
}

export const runtimeObservabilityRepository = new RuntimeObservabilityPersistenceRepository();
