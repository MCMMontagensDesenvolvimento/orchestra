import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../../shared/validation/pagination';
import type {
  McpRemoteCatalogApplyLedgersQuery,
  McpRemoteCatalogEntriesQuery,
} from './mcp-remote-catalog-admin.schema';

type RemoteCatalogAdminPrisma = Pick<PrismaClient, 'mcpRemoteCatalogEntry' | 'mcpRemoteCatalogApplyLedger'>;

const entryListSelect = {
  id: true,
  tenantId: true,
  workspaceId: true,
  mcpServerId: true,
  externalName: true,
  displayName: true,
  description: true,
  source: true,
  lifecycleStatus: true,
  riskLevel: true,
  requiresApproval: true,
  specHash: true,
  catalogHash: true,
  allowRuntimeExecution: true,
  sandboxOnly: true,
  blockedByDefault: true,
  approvalMode: true,
  runtimeEnabled: true,
  remoteExecutionEnabled: true,
  snapshotId: true,
  snapshotHash: true,
  lastPlanId: true,
  lastPlanHash: true,
  lastApplyId: true,
  lastApplyHash: true,
  revision: true,
  importedByUserId: true,
  importedAt: true,
  approvedByUserId: true,
  approvedAt: true,
  deprecatedByUserId: true,
  deprecatedAt: true,
  deprecationReasonHash: true,
  materializedMcpToolId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.McpRemoteCatalogEntrySelect;

const entryDetailSelect = {
  ...entryListSelect,
  inputSchema: true,
  outputSchema: true,
} satisfies Prisma.McpRemoteCatalogEntrySelect;

const ledgerListSelect = {
  id: true,
  tenantId: true,
  workspaceId: true,
  mcpServerId: true,
  planId: true,
  planHash: true,
  snapshotHash: true,
  applyId: true,
  applyHash: true,
  approvedByUserId: true,
  status: true,
  summary: true,
  schemaVersion: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.McpRemoteCatalogApplyLedgerSelect;

const ledgerDetailSelect = {
  ...ledgerListSelect,
  idempotencyKey: true,
  approvalReasonHash: true,
  operationResults: true,
} satisfies Prisma.McpRemoteCatalogApplyLedgerSelect;

export type McpRemoteCatalogEntryListRecord = Prisma.McpRemoteCatalogEntryGetPayload<{ select: typeof entryListSelect }>;
export type McpRemoteCatalogEntryDetailRecord = Prisma.McpRemoteCatalogEntryGetPayload<{ select: typeof entryDetailSelect }>;
export type McpRemoteCatalogApplyLedgerListRecord = Prisma.McpRemoteCatalogApplyLedgerGetPayload<{ select: typeof ledgerListSelect }>;
export type McpRemoteCatalogApplyLedgerDetailRecord = Prisma.McpRemoteCatalogApplyLedgerGetPayload<{ select: typeof ledgerDetailSelect }>;

function workspaceWhere(queryWorkspaceId: string | undefined, workspaceIds: string[]) {
  return queryWorkspaceId ?? { in: workspaceIds };
}

function entriesWhere(tenantId: string, workspaceIds: string[], query: McpRemoteCatalogEntriesQuery): Prisma.McpRemoteCatalogEntryWhereInput {
  return {
    tenantId,
    workspaceId: workspaceWhere(query.workspaceId, workspaceIds),
    ...(query.serverId ? { mcpServerId: query.serverId } : {}),
    ...(query.externalName ? { externalName: query.externalName } : {}),
    ...(query.lifecycleStatus ? { lifecycleStatus: query.lifecycleStatus } : {}),
    ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}),
    ...(typeof query.requiresApproval === 'boolean' ? { requiresApproval: query.requiresApproval } : {}),
    ...(query.snapshotHash ? { snapshotHash: query.snapshotHash } : {}),
    ...(query.specHash ? { specHash: query.specHash } : {}),
    ...(query.catalogHash ? { catalogHash: query.catalogHash } : {}),
    ...(query.lastPlanHash ? { lastPlanHash: query.lastPlanHash } : {}),
    ...(query.lastApplyHash ? { lastApplyHash: query.lastApplyHash } : {}),
    ...(query.search
      ? {
          OR: [
            { externalName: { contains: query.search, mode: 'insensitive' } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

function ledgersWhere(tenantId: string, workspaceIds: string[], query: McpRemoteCatalogApplyLedgersQuery): Prisma.McpRemoteCatalogApplyLedgerWhereInput {
  return {
    tenantId,
    workspaceId: workspaceWhere(query.workspaceId, workspaceIds),
    ...(query.serverId ? { mcpServerId: query.serverId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    ...(query.planHash ? { planHash: query.planHash } : {}),
    ...(query.snapshotHash ? { snapshotHash: query.snapshotHash } : {}),
    ...(query.applyId ? { applyId: query.applyId } : {}),
    ...(query.applyHash ? { applyHash: query.applyHash } : {}),
    ...(query.idempotencyKey ? { idempotencyKey: query.idempotencyKey } : {}),
    ...(query.approvedByUserId ? { approvedByUserId: query.approvedByUserId } : {}),
    ...(query.createdAtFrom || query.createdAtTo
      ? {
          createdAt: {
            ...(query.createdAtFrom ? { gte: query.createdAtFrom } : {}),
            ...(query.createdAtTo ? { lte: query.createdAtTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { planId: { contains: query.search, mode: 'insensitive' } },
            { applyId: { contains: query.search, mode: 'insensitive' } },
            { status: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export class McpRemoteCatalogAdminPersistenceRepository {
  constructor(private readonly db: RemoteCatalogAdminPrisma = defaultPrisma) {}

  listDiscoverySpecs(
    tenantId: string,
    workspaceId: string,
    serverId: string,
  ) {
    return this.db.mcpRemoteCatalogEntry.findMany({
      where: {
        tenantId,
        workspaceId,
        mcpServerId: serverId,
        deletedAt: null,
      },
      select: {
        externalName: true,
        specHash: true,
      },
      orderBy: {
        externalName: 'asc',
      },
    });
  }

  async listEntries(tenantId: string, workspaceIds: string[], query: McpRemoteCatalogEntriesQuery) {
    const where = entriesWhere(tenantId, workspaceIds, query);
    const orderBy = { [query.sortBy]: query.sortDirection } satisfies Prisma.McpRemoteCatalogEntryOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.db.mcpRemoteCatalogEntry.findMany({
        where,
        select: entryListSelect,
        orderBy,
        ...paginationOffset(query),
      }),
      this.db.mcpRemoteCatalogEntry.count({ where }),
    ]);

    return { data, total };
  }

  findEntry(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.mcpRemoteCatalogEntry.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: entryDetailSelect,
    });
  }

  async listApplyLedgers(tenantId: string, workspaceIds: string[], query: McpRemoteCatalogApplyLedgersQuery) {
    const where = ledgersWhere(tenantId, workspaceIds, query);
    const orderBy = { [query.sortBy]: query.sortDirection } satisfies Prisma.McpRemoteCatalogApplyLedgerOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.db.mcpRemoteCatalogApplyLedger.findMany({
        where,
        select: ledgerListSelect,
        orderBy,
        ...paginationOffset(query),
      }),
      this.db.mcpRemoteCatalogApplyLedger.count({ where }),
    ]);

    return { data, total };
  }

  findApplyLedger(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.mcpRemoteCatalogApplyLedger.findFirst({
      where: {
        id,
        tenantId,
        workspaceId: { in: workspaceIds },
      },
      select: ledgerDetailSelect,
    });
  }
}

export const mcpRemoteCatalogAdminRepository = new McpRemoteCatalogAdminPersistenceRepository();
