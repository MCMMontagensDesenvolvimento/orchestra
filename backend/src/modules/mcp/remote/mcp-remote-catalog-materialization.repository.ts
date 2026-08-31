import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infrastructure/prisma/prisma.service';

const materializedToolInclude = {
  policies: { take: 1 },
} satisfies Prisma.McpToolInclude;

const entrySelect = {
  id: true,
  tenantId: true,
  workspaceId: true,
  mcpServerId: true,
  externalName: true,
  displayName: true,
  description: true,
  lifecycleStatus: true,
  riskLevel: true,
  requiresApproval: true,
  specHash: true,
  catalogHash: true,
  inputSchema: true,
  outputSchema: true,
  allowRuntimeExecution: true,
  sandboxOnly: true,
  blockedByDefault: true,
  approvalMode: true,
  runtimeEnabled: true,
  remoteExecutionEnabled: true,
  snapshotHash: true,
  lastPlanHash: true,
  lastApplyHash: true,
  approvedByUserId: true,
  approvedAt: true,
  materializedMcpToolId: true,
  deletedAt: true,
  server: {
    select: {
      id: true,
      tenantId: true,
      workspaceId: true,
      serverType: true,
      status: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.McpRemoteCatalogEntrySelect;

type MaterializationEntry =
  Prisma.McpRemoteCatalogEntryGetPayload<{ select: typeof entrySelect }>;

type MaterializedTool =
  Prisma.McpToolGetPayload<{ include: typeof materializedToolInclude }>;

export type McpRemoteCatalogMaterializationBlockedReason =
  | 'entry_not_approved'
  | 'approval_missing'
  | 'policy_not_closed'
  | 'server_not_remote'
  | 'server_not_active'
  | 'materialization_integrity_failed';

export type McpRemoteCatalogMaterializationResult =
  | {
      status: 'not_found';
    }
  | {
      status: 'blocked';
      reason: McpRemoteCatalogMaterializationBlockedReason;
      entry: MaterializationEntry;
    }
  | {
      status: 'materialized' | 'already_materialized';
      entry: MaterializationEntry;
      tool: MaterializedTool;
    };

class McpRemoteCatalogMaterializationRaceError extends Error {
  constructor() {
    super('MCP_REMOTE_CATALOG_MATERIALIZATION_RACE');
    this.name = 'McpRemoteCatalogMaterializationRaceError';
  }
}

function jsonInput(
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | undefined {
  if (value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function closedPolicyViolation(entry: MaterializationEntry) {
  return (
    entry.requiresApproval !== true
    || entry.allowRuntimeExecution !== false
    || entry.sandboxOnly !== true
    || entry.blockedByDefault !== true
    || entry.approvalMode !== 'manual'
    || entry.runtimeEnabled !== false
    || entry.remoteExecutionEnabled !== false
  );
}

function prismaSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2034'
  );
}

export class McpRemoteCatalogMaterializationRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  private async materializeOnce(input: {
    entryId: string;
    tenantId: string;
    workspaceIds: string[];
  }): Promise<McpRemoteCatalogMaterializationResult> {
    return this.db.$transaction(
      async (tx) => {
        const entry = await tx.mcpRemoteCatalogEntry.findFirst({
          where: {
            id: input.entryId,
            tenantId: input.tenantId,
            workspaceId: { in: input.workspaceIds },
          },
          select: entrySelect,
        });

        if (!entry) {
          return { status: 'not_found' };
        }

        if (entry.materializedMcpToolId) {
          const existingTool = await tx.mcpTool.findFirst({
            where: {
              id: entry.materializedMcpToolId,
              tenantId: entry.tenantId,
              workspaceId: entry.workspaceId,
              mcpServerId: entry.mcpServerId,
            },
            include: materializedToolInclude,
          });

          if (!existingTool) {
            return {
              status: 'blocked',
              reason: 'materialization_integrity_failed',
              entry,
            };
          }

          return {
            status: 'already_materialized',
            entry,
            tool: existingTool,
          };
        }

        if (
          entry.deletedAt
          || entry.lifecycleStatus !== 'approved_for_catalog'
        ) {
          return {
            status: 'blocked',
            reason: 'entry_not_approved',
            entry,
          };
        }

        if (!entry.approvedByUserId || !entry.approvedAt) {
          return {
            status: 'blocked',
            reason: 'approval_missing',
            entry,
          };
        }

        if (closedPolicyViolation(entry)) {
          return {
            status: 'blocked',
            reason: 'policy_not_closed',
            entry,
          };
        }

        if (entry.server.serverType !== 'remote') {
          return {
            status: 'blocked',
            reason: 'server_not_remote',
            entry,
          };
        }

        if (
          entry.server.status !== 'active'
          || entry.server.deletedAt
        ) {
          return {
            status: 'blocked',
            reason: 'server_not_active',
            entry,
          };
        }

        const tool = await tx.mcpTool.create({
          data: {
            tenantId: entry.tenantId,
            workspaceId: entry.workspaceId,
            mcpServerId: entry.mcpServerId,

            // Protocol identifier. The human-readable display name
            // remains available in metadata.
            name: entry.externalName,
            description: entry.description,

            inputSchema: jsonInput(entry.inputSchema),
            outputSchema: jsonInput(entry.outputSchema),

            riskLevel: entry.riskLevel,
            requiresApproval: true,

            // Materialization does NOT authorize execution.
            isEnabled: false,

            metadata: {
              source: 'remote_catalog_materialization',
              remoteCatalog: true,
              remoteCatalogEntryId: entry.id,
              externalName: entry.externalName,
              displayName: entry.displayName,
              catalogHash: entry.catalogHash,
              specHash: entry.specHash,
              snapshotHash: entry.snapshotHash,
              lastPlanHash: entry.lastPlanHash,
              lastApplyHash: entry.lastApplyHash,
              readOnly: true,
              noRuntimeExecution: true,
              noRemoteExecution: true,
            },

            policies: {
              create: {
                tenantId: entry.tenantId,
                workspaceId: entry.workspaceId,
                mcpServerId: entry.mcpServerId,
                allowRuntimeExecution: false,
                sandboxOnly: true,
                requiresApproval: true,
                blockedByDefault: true,
                metadata: {
                  source: 'remote_catalog_materialization',
                  remoteCatalogEntryId: entry.id,
                  readOnly: true,
                },
              },
            },
          },
          include: materializedToolInclude,
        });

        const claim = await tx.mcpRemoteCatalogEntry.updateMany({
          where: {
            id: entry.id,
            tenantId: entry.tenantId,
            workspaceId: entry.workspaceId,
            mcpServerId: entry.mcpServerId,
            materializedMcpToolId: null,
          },
          data: {
            materializedMcpToolId: tool.id,
          },
        });

        if (claim.count !== 1) {
          // Throwing here rolls back the newly-created McpTool and policy.
          throw new McpRemoteCatalogMaterializationRaceError();
        }

        return {
          status: 'materialized',
          entry: {
            ...entry,
            materializedMcpToolId: tool.id,
          },
          tool,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async materialize(input: {
    entryId: string;
    tenantId: string;
    workspaceIds: string[];
  }): Promise<McpRemoteCatalogMaterializationResult> {
    // A concurrent materialization may cause either our explicit
    // claim race or PostgreSQL/Prisma P2034. Retry with a new
    // SERIALIZABLE transaction so the winner can be returned
    // idempotently.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.materializeOnce(input);
      } catch (error) {
        const retryable =
          error instanceof McpRemoteCatalogMaterializationRaceError
          || prismaSerializationConflict(error);

        if (!retryable || attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error('MCP_REMOTE_CATALOG_MATERIALIZATION_RETRY_EXHAUSTED');
  }
}

export const mcpRemoteCatalogMaterializationRepository =
  new McpRemoteCatalogMaterializationRepository();
