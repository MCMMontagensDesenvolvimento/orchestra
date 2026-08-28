import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infrastructure/prisma/prisma.service';
import { recordAuditEvent as writeAuditEvent } from '../../audit/audit.service';
import type {
  McpRemoteCatalogApplyMutationContext,
  McpRemoteCatalogApplyReservationInput,
  McpRemoteCatalogImportApplyAuditEvent,
  McpRemoteCatalogImportApplyCatalogItem,
  McpRemoteCatalogImportApplyOperationResult,
  McpRemoteCatalogImportApplyRepository,
  McpRemoteCatalogImportApplyResult,
  McpRemoteCatalogImportApplyStatus,
  McpRemoteCatalogImportApplyTransaction,
  McpRemoteCatalogPolicyDraft,
  McpRemoteDiscoveredToolRiskLevel,
} from './mcp-remote.types';

export const MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY = 'MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY';
export const MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS = 'MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS';
export const MCP_REMOTE_CATALOG_APPLY_CONFLICT = 'MCP_REMOTE_CATALOG_APPLY_CONFLICT';

const unsafeKeyFragments = [
  'apikey',
  'authorization',
  'baseurl',
  'cookie',
  'credential',
  'password',
  'privatekey',
  'secret',
  'secretref',
  'token',
];

const sensitiveTextPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;
const hexSha256Pattern = /^[a-f0-9]{64}$/;
const riskLevels = new Set<McpRemoteDiscoveredToolRiskLevel>(['low', 'medium', 'high', 'critical']);

type RemoteCatalogPrisma = PrismaClient | Prisma.TransactionClient;
type EntryRecord = Awaited<ReturnType<RemoteCatalogPrisma['mcpRemoteCatalogEntry']['findFirst']>>;
type LedgerRecord = Awaited<ReturnType<RemoteCatalogPrisma['mcpRemoteCatalogApplyLedger']['findFirst']>>;

function normalizedKey(key: string) {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function isUnsafeKey(key: string) {
  const normalized = normalizedKey(key);
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment));
}

function containsUnsafeText(value: string) {
  const normalized = value.toLowerCase();
  return unsafeKeyFragments.some((fragment) => normalized.includes(fragment)) || sensitiveTextPattern.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeForHash(item));
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const child = normalizeForHash(value[key]);
      if (typeof child !== 'undefined') normalized[key] = child;
    }
    return normalized;
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForHash(value));
}

function sha256(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function hashOrSha256(value: unknown) {
  if (typeof value === 'string' && hexSha256Pattern.test(value.toLowerCase())) return value.toLowerCase();
  return sha256(value);
}

function safeString(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || containsUnsafeText(normalized)) return undefined;
  return normalized.slice(0, maxChars);
}

function sanitizePersistenceValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;

  if (typeof value === 'string') {
    return containsUnsafeText(value) ? '[redacted]' : value.slice(0, 300);
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return undefined;
  }

  if (depth >= 5) return '[truncated]';

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizePersistenceValue(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }

  if (!isRecord(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (isUnsafeKey(key)) continue;
    const sanitizedValue = sanitizePersistenceValue(value[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  const sanitized = sanitizePersistenceValue(value);
  return typeof sanitized === 'undefined' ? undefined : sanitized as Prisma.InputJsonValue;
}

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  return sanitizePersistenceValue(value, depth);
}

function sanitizeAuditEvent(event: McpRemoteCatalogImportApplyAuditEvent): McpRemoteCatalogImportApplyAuditEvent {
  return {
    type: 'mcp.remote.catalog_import_apply.executed',
    tenantId: event.tenantId,
    workspaceId: event.workspaceId,
    serverId: event.serverId,
    planHash: event.planHash,
    applyHash: event.applyHash,
    approvedByUserId: event.approvedByUserId,
    status: event.status,
    counts: Object.fromEntries(
      Object.entries(event.counts)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .slice(0, 20),
    ),
    operationTypes: event.operationTypes.filter((value) => typeof value === 'string').slice(0, 20),
    metadata: (sanitizeAuditValue(event.metadata) as Record<string, unknown>) ?? {},
  };
}

function policyIsClosed(policy: McpRemoteCatalogPolicyDraft) {
  return policy.allowRuntimeExecution === false
    && policy.sandboxOnly === true
    && policy.blockedByDefault === true
    && policy.requiresApproval === true
    && policy.approvalMode === 'manual'
    && policy.runtimeEnabled === false
    && policy.remoteExecutionEnabled === false;
}

function riskLevel(input?: McpRemoteDiscoveredToolRiskLevel | string | null) {
  return input && riskLevels.has(input as McpRemoteDiscoveredToolRiskLevel)
    ? input as McpRemoteDiscoveredToolRiskLevel
    : 'medium';
}

function lifecycleStatus(context?: McpRemoteCatalogApplyMutationContext) {
  return context?.approvedByUserId ? 'approved_for_catalog' : 'draft';
}

function catalogHash(input: {
  externalName: string;
  displayName: string;
  description?: string | null;
  source: string;
  lifecycleStatus: string;
  riskLevel: string;
  requiresApproval: boolean;
  specHash: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  policy: McpRemoteCatalogPolicyDraft;
  snapshotHash: string;
}) {
  return sha256(input);
}

function deprecationCatalogHash(input: {
  previousCatalogHash?: string | null;
  externalName: string;
  reasonHash: string;
  applyHash: string;
}) {
  return sha256({ ...input, lifecycleStatus: 'deprecated' });
}

function operationResultsPayload(result: McpRemoteCatalogImportApplyResult) {
  return toInputJson({
    operationResults: result.operationResults,
    sanitizedMetadata: result.sanitizedMetadata,
    rollbackNotes: result.rollbackNotes,
    auditEventMetadata: result.auditEvent.metadata,
    appliedAt: result.appliedAt,
    schemaVersion: 1,
  });
}

function readOperationResultsPayload(value: unknown) {
  if (!isRecord(value)) {
    return {
      operationResults: [],
      sanitizedMetadata: {},
      rollbackNotes: [],
      auditEventMetadata: {},
      appliedAt: undefined,
    };
  }
  return {
    operationResults: Array.isArray(value.operationResults)
      ? value.operationResults as McpRemoteCatalogImportApplyOperationResult[]
      : [],
    sanitizedMetadata: isRecord(value.sanitizedMetadata) ? value.sanitizedMetadata : {},
    rollbackNotes: Array.isArray(value.rollbackNotes) ? value.rollbackNotes as McpRemoteCatalogImportApplyResult['rollbackNotes'] : [],
    auditEventMetadata: isRecord(value.auditEventMetadata) ? value.auditEventMetadata : {},
    appliedAt: typeof value.appliedAt === 'string' ? value.appliedAt : undefined,
  };
}

function resultSummary(value: unknown): McpRemoteCatalogImportApplyResult['summary'] {
  if (!isRecord(value)) {
    return { total: 0, applied: 0, blocked: 0, skipped: 0, failed: 0, noop: 0, idempotent: 0 };
  }
  return {
    total: typeof value.total === 'number' ? value.total : 0,
    applied: typeof value.applied === 'number' ? value.applied : 0,
    blocked: typeof value.blocked === 'number' ? value.blocked : 0,
    skipped: typeof value.skipped === 'number' ? value.skipped : 0,
    failed: typeof value.failed === 'number' ? value.failed : 0,
    noop: typeof value.noop === 'number' ? value.noop : 0,
    idempotent: typeof value.idempotent === 'number' ? value.idempotent : 0,
  };
}

function toApplyResult(ledger: NonNullable<LedgerRecord>): McpRemoteCatalogImportApplyResult {
  if (ledger.status === 'started') throw new McpRemoteCatalogApplyInProgressError();

  const payload = readOperationResultsPayload(ledger.operationResults);
  const summary = resultSummary(ledger.summary);
  const appliedAt = payload.appliedAt ?? ledger.completedAt?.toISOString() ?? ledger.createdAt.toISOString();
  const status = ledger.status as McpRemoteCatalogImportApplyStatus;

  return {
    applyId: ledger.applyId,
    applyHash: ledger.applyHash,
    idempotencyKey: ledger.idempotencyKey,
    planId: ledger.planId,
    planHash: ledger.planHash,
    snapshotHash: ledger.snapshotHash,
    serverId: ledger.mcpServerId,
    tenantId: ledger.tenantId,
    workspaceId: ledger.workspaceId,
    approvedByUserId: ledger.approvedByUserId ?? 'unknown',
    appliedAt,
    status,
    operationResults: payload.operationResults,
    summary,
    auditEvent: {
      type: 'mcp.remote.catalog_import_apply.executed',
      tenantId: ledger.tenantId,
      workspaceId: ledger.workspaceId,
      serverId: ledger.mcpServerId,
      planHash: ledger.planHash,
      applyHash: ledger.applyHash,
      approvedByUserId: ledger.approvedByUserId ?? 'unknown',
      status,
      counts: summary,
      operationTypes: [...new Set(payload.operationResults.map((item) => item.type))].sort(),
      metadata: payload.auditEventMetadata,
    },
    sanitizedMetadata: payload.sanitizedMetadata,
    rollbackNotes: payload.rollbackNotes,
  };
}

function mapEntry(entry: NonNullable<EntryRecord>): McpRemoteCatalogImportApplyCatalogItem {
  const metadata = sanitizePersistenceValue(entry.internalMetadata);
  return {
    id: entry.id,
    externalName: entry.externalName,
    displayName: entry.displayName,
    description: entry.description,
    specHash: entry.specHash,
    status: entry.lifecycleStatus,
    lifecycleStatus: entry.lifecycleStatus,
    riskLevel: riskLevel(entry.riskLevel),
    requiresApproval: entry.requiresApproval,
    catalogHash: entry.catalogHash,
    revision: entry.revision,
    ...(isRecord(metadata) ? { metadata } : {}),
  };
}

function prismaErrorCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

function isTransactionCapable(db: RemoteCatalogPrisma): db is PrismaClient {
  return '$transaction' in db && typeof db.$transaction === 'function';
}

export interface McpRemoteCatalogImportApplyAuditRecord {
  tenantId: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  entity: 'mcp_remote_catalog_import_apply';
  entityId: string;
  event: McpRemoteCatalogImportApplyAuditEvent;
}

export interface McpRemoteCatalogImportApplyAuditWriter {
  record(input: McpRemoteCatalogImportApplyAuditRecord): Promise<void>;
}

const defaultAuditWriter: McpRemoteCatalogImportApplyAuditWriter = {
  async record(input) {
    await writeAuditEvent({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.event as unknown as Prisma.InputJsonValue,
    });
  },
};

export class McpRemoteCatalogPersistenceNotReadyError extends Error {
  readonly code = MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY;

  constructor(operation: 'create_tool_draft' | 'update_tool_draft' | 'deprecate_tool_draft') {
    super(`${MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY}: ${operation} is a legacy fail-closed state superseded by the phase 11J repository.`);
    this.name = 'McpRemoteCatalogPersistenceNotReadyError';
  }
}

export class McpRemoteCatalogApplyInProgressError extends Error {
  readonly code = MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS;

  constructor() {
    super(`${MCP_REMOTE_CATALOG_APPLY_IN_PROGRESS}: apply ledger is started and requires manual reconciliation.`);
    this.name = 'McpRemoteCatalogApplyInProgressError';
  }
}

export class McpRemoteCatalogApplyConflictError extends Error {
  readonly code = MCP_REMOTE_CATALOG_APPLY_CONFLICT;

  constructor(message: string) {
    super(`${MCP_REMOTE_CATALOG_APPLY_CONFLICT}: ${message}`);
    this.name = 'McpRemoteCatalogApplyConflictError';
  }
}

export class McpRemoteCatalogImportApplyPersistenceRepository implements McpRemoteCatalogImportApplyRepository {
  constructor(
    private readonly auditWriter: McpRemoteCatalogImportApplyAuditWriter = defaultAuditWriter,
    private readonly db: RemoteCatalogPrisma = defaultPrisma,
  ) {}

  async withTransaction<T>(fn: (transaction: McpRemoteCatalogImportApplyTransaction) => Promise<T>): Promise<T> {
    if (!isTransactionCapable(this.db)) return fn(this);

    return this.db.$transaction(
      async (transaction) => fn(new McpRemoteCatalogImportApplyPersistenceRepository(this.auditWriter, transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findByExternalName(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['findByExternalName']>[0],
  ): Promise<McpRemoteCatalogImportApplyCatalogItem | null> {
    const entry = await this.db.mcpRemoteCatalogEntry.findFirst({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        externalName: input.externalName,
      },
    });

    return entry ? mapEntry(entry) : null;
  }

  async createToolDraft(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['createToolDraft']>[0],
  ): Promise<{ id: string; catalogHash?: string | null }> {
    if (!policyIsClosed(input.policyDraft)) {
      throw new McpRemoteCatalogApplyConflictError('create_tool_draft attempted to persist an open runtime policy.');
    }

    const context = this.requireApplyContext(input.applyContext);
    await this.assertServerScope(input.tenantId, input.workspaceId, input.serverId);

    const specHash = hashOrSha256(input.specHash ?? input.catalogDraft.specHash ?? input.externalName);
    const displayName = safeString(input.displayName ?? input.catalogDraft.displayName, 160) ?? input.externalName.slice(0, 160);
    const description = safeString(input.description ?? input.catalogDraft.description, 1000);
    const inputSchema = toInputJson(input.catalogDraft.inputSchema);
    const outputSchema = toInputJson(input.catalogDraft.outputSchema);
    const entryLifecycleStatus = lifecycleStatus(context);
    const entryRiskLevel = riskLevel(input.riskLevel ?? input.catalogDraft.metadata?.riskLevel as string | undefined);
    const entryCatalogHash = catalogHash({
      externalName: input.externalName,
      displayName,
      description,
      source: 'remote_discovery',
      lifecycleStatus: entryLifecycleStatus,
      riskLevel: entryRiskLevel,
      requiresApproval: true,
      specHash,
      inputSchema,
      outputSchema,
      policy: input.policyDraft,
      snapshotHash: hashOrSha256(context.snapshotHash),
    });

    try {
      const entry = await this.db.mcpRemoteCatalogEntry.create({
        data: {
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          mcpServerId: input.serverId,
          externalName: input.externalName,
          displayName,
          ...(description ? { description } : {}),
          source: 'remote_discovery',
          lifecycleStatus: entryLifecycleStatus,
          riskLevel: entryRiskLevel,
          requiresApproval: true,
          specHash,
          catalogHash: entryCatalogHash,
          ...(typeof inputSchema !== 'undefined' ? { inputSchema } : {}),
          ...(typeof outputSchema !== 'undefined' ? { outputSchema } : {}),
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
          approvalMode: 'manual',
          runtimeEnabled: false,
          remoteExecutionEnabled: false,
          snapshotId: context.snapshotId,
          snapshotHash: hashOrSha256(context.snapshotHash),
          lastPlanId: context.planId,
          lastPlanHash: hashOrSha256(context.planHash),
          lastApplyId: context.applyId,
          lastApplyHash: hashOrSha256(context.applyHash),
          revision: 1,
          importedByUserId: context.approvedByUserId,
          importedAt: new Date(context.appliedAt),
          approvedByUserId: context.approvedByUserId,
          approvedAt: new Date(context.approvedAt ?? context.appliedAt),
          materializedMcpToolId: null,
          internalMetadata: toInputJson({
            schemaVersion: 1,
            source: 'mcp_remote_catalog_import_apply_11j',
            operationType: 'create_tool_draft',
            catalogDraftMetadata: input.catalogDraft.metadata,
          }),
        },
      });

      return { id: entry.id, catalogHash: entry.catalogHash };
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new McpRemoteCatalogApplyConflictError('remote catalog entry already exists for this tenant/workspace/server/externalName.');
      }
      throw error;
    }
  }

  async updateToolDraft(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['updateToolDraft']>[0],
  ): Promise<{ id: string; catalogHash?: string | null }> {
    if (!policyIsClosed(input.policyDraft)) {
      throw new McpRemoteCatalogApplyConflictError('update_tool_draft attempted to persist an open runtime policy.');
    }

    const context = this.requireApplyContext(input.applyContext);
    await this.assertServerScope(input.tenantId, input.workspaceId, input.serverId);

    const existing = await this.db.mcpRemoteCatalogEntry.findFirst({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        externalName: input.externalName,
      },
    });
    if (!existing || existing.lifecycleStatus === 'archived') {
      throw new McpRemoteCatalogApplyConflictError('remote catalog entry was not found in scope or is archived.');
    }

    const specHash = hashOrSha256(input.specHash ?? input.catalogDraft.specHash ?? input.externalName);
    const displayName = safeString(input.displayName ?? input.catalogDraft.displayName, 160) ?? existing.displayName;
    const description = safeString(input.description ?? input.catalogDraft.description, 1000);
    const inputSchema = toInputJson(input.catalogDraft.inputSchema);
    const outputSchema = toInputJson(input.catalogDraft.outputSchema);
    const entryRiskLevel = riskLevel(input.riskLevel ?? input.catalogDraft.metadata?.riskLevel as string | undefined);
    const nextLifecycleStatus = existing.lifecycleStatus === 'deprecated' ? 'approved_for_catalog' : existing.lifecycleStatus;
    const entryCatalogHash = catalogHash({
      externalName: input.externalName,
      displayName,
      description,
      source: 'remote_discovery',
      lifecycleStatus: nextLifecycleStatus,
      riskLevel: entryRiskLevel,
      requiresApproval: true,
      specHash,
      inputSchema,
      outputSchema,
      policy: input.policyDraft,
      snapshotHash: hashOrSha256(context.snapshotHash),
    });

    const updated = await this.db.mcpRemoteCatalogEntry.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        externalName: input.externalName,
        ...(typeof input.expectedRevision === 'number' ? { revision: input.expectedRevision } : {}),
      },
      data: {
        displayName,
        description: description ?? null,
        lifecycleStatus: nextLifecycleStatus,
        riskLevel: entryRiskLevel,
        requiresApproval: true,
        specHash,
        catalogHash: entryCatalogHash,
        inputSchema: typeof inputSchema === 'undefined' ? Prisma.JsonNull : inputSchema,
        outputSchema: typeof outputSchema === 'undefined' ? Prisma.JsonNull : outputSchema,
        allowRuntimeExecution: false,
        sandboxOnly: true,
        blockedByDefault: true,
        approvalMode: 'manual',
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
        snapshotId: context.snapshotId,
        snapshotHash: hashOrSha256(context.snapshotHash),
        lastPlanId: context.planId,
        lastPlanHash: hashOrSha256(context.planHash),
        lastApplyId: context.applyId,
        lastApplyHash: hashOrSha256(context.applyHash),
        approvedByUserId: context.approvedByUserId,
        approvedAt: new Date(context.approvedAt ?? context.appliedAt),
        internalMetadata: toInputJson({
          schemaVersion: 1,
          source: 'mcp_remote_catalog_import_apply_11j',
          operationType: 'update_tool_draft',
          catalogDraftMetadata: input.catalogDraft.metadata,
        }),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new McpRemoteCatalogApplyConflictError('remote catalog entry revision changed before update.');
    }

    const entry = await this.db.mcpRemoteCatalogEntry.findUnique({ where: { id: input.id } });
    return { id: input.id, catalogHash: entry?.catalogHash ?? entryCatalogHash };
  }

  async deprecateToolDraft(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['deprecateToolDraft']>[0],
  ): Promise<{ id: string; catalogHash?: string | null }> {
    const context = this.requireApplyContext(input.applyContext);
    await this.assertServerScope(input.tenantId, input.workspaceId, input.serverId);

    const existing = await this.db.mcpRemoteCatalogEntry.findFirst({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        externalName: input.externalName,
      },
    });
    if (!existing || existing.lifecycleStatus === 'archived') {
      throw new McpRemoteCatalogApplyConflictError('remote catalog entry was not found in scope or is archived.');
    }

    const reasonHash = hashOrSha256(input.reason);
    const nextCatalogHash = deprecationCatalogHash({
      previousCatalogHash: existing.catalogHash,
      externalName: input.externalName,
      reasonHash,
      applyHash: hashOrSha256(context.applyHash),
    });
    const updated = await this.db.mcpRemoteCatalogEntry.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        externalName: input.externalName,
        ...(typeof input.expectedRevision === 'number' ? { revision: input.expectedRevision } : {}),
      },
      data: {
        lifecycleStatus: 'deprecated',
        catalogHash: nextCatalogHash,
        lastPlanId: context.planId,
        lastPlanHash: hashOrSha256(context.planHash),
        lastApplyId: context.applyId,
        lastApplyHash: hashOrSha256(context.applyHash),
        deprecatedByUserId: context.approvedByUserId,
        deprecatedAt: new Date(context.appliedAt),
        deprecationReasonHash: reasonHash,
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new McpRemoteCatalogApplyConflictError('remote catalog entry revision changed before deprecate.');
    }

    const entry = await this.db.mcpRemoteCatalogEntry.findUnique({ where: { id: input.id } });
    return { id: input.id, catalogHash: entry?.catalogHash ?? nextCatalogHash };
  }

  async reserveApply(input: McpRemoteCatalogApplyReservationInput): Promise<void> {
    const scope = {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      mcpServerId: input.serverId,
    };

    const existingByIdempotencyKey =
      await this.db.mcpRemoteCatalogApplyLedger.findFirst({
        where: {
          ...scope,
          idempotencyKey: hashOrSha256(input.idempotencyKey),
        },
      });

    if (existingByIdempotencyKey) {
      if (existingByIdempotencyKey.status === 'started') {
        throw new McpRemoteCatalogApplyInProgressError();
      }

      throw new McpRemoteCatalogApplyConflictError(
        'apply ledger already has a final result for this idempotency key.',
      );
    }

    const existingByPlan =
      await this.db.mcpRemoteCatalogApplyLedger.findFirst({
        where: {
          ...scope,
          planId: input.planId,
        },
      });

    if (existingByPlan) {
      if (existingByPlan.status === 'started') {
        throw new McpRemoteCatalogApplyInProgressError();
      }

      throw new McpRemoteCatalogApplyConflictError(
        'apply ledger already has a final result for this governed import plan.',
      );
    }

    try {
      await this.db.mcpRemoteCatalogApplyLedger.create({
        data: {
          ...scope,
          planId: input.planId,
          planHash: hashOrSha256(input.planHash),
          snapshotHash: hashOrSha256(input.snapshotHash),
          applyId: input.applyId,
          applyHash: hashOrSha256(input.applyHash),
          idempotencyKey: hashOrSha256(input.idempotencyKey),
          approvedByUserId: input.approvedByUserId,
          approvalReasonHash: input.approvalReasonHash
            ? hashOrSha256(input.approvalReasonHash)
            : undefined,
          status: 'started',
          summary: undefined,
          operationResults: undefined,
          schemaVersion: 1,
        },
      });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new McpRemoteCatalogApplyInProgressError();
      }

      throw error;
    }
  }

  async finalizeCatalogEntriesForApply(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    applyId: string;
    applyHash: string;
    operationResults: McpRemoteCatalogImportApplyOperationResult[];
  }): Promise<void> {
    const appliedIds = input.operationResults
      .filter((result) => result.status === 'applied' && typeof result.catalogItemId === 'string')
      .map((result) => result.catalogItemId as string);
    if (appliedIds.length === 0) return;

    await this.db.mcpRemoteCatalogEntry.updateMany({
      where: {
        id: { in: [...new Set(appliedIds)] },
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
      },
      data: {
        lastApplyId: input.applyId,
        lastApplyHash: hashOrSha256(input.applyHash),
      },
    });
  }

  async findApplyByIdempotencyKey(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    idempotencyKey: string;
  }): Promise<McpRemoteCatalogImportApplyResult | null> {
    const ledger = await this.db.mcpRemoteCatalogApplyLedger.findFirst({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        idempotencyKey: hashOrSha256(input.idempotencyKey),
      },
    });
    return ledger ? toApplyResult(ledger) : null;
  }

  async saveApplyResult(input: {
    idempotencyKey: string;
    result: McpRemoteCatalogImportApplyResult;
  }): Promise<void> {
    const data = {
      planId: input.result.planId,
      planHash: hashOrSha256(input.result.planHash),
      snapshotHash: hashOrSha256(input.result.snapshotHash),
      applyId: input.result.applyId,
      applyHash: hashOrSha256(input.result.applyHash),
      approvedByUserId: input.result.approvedByUserId,
      status: input.result.status,
      summary: toInputJson(input.result.summary),
      operationResults: operationResultsPayload(input.result),
      schemaVersion: 1,
      completedAt: new Date(input.result.appliedAt),
    };

    const existing = await this.db.mcpRemoteCatalogApplyLedger.findFirst({
      where: {
        tenantId: input.result.tenantId,
        workspaceId: input.result.workspaceId,
        mcpServerId: input.result.serverId,
        idempotencyKey: hashOrSha256(input.idempotencyKey),
      },
    });

    if (existing) {
      await this.db.mcpRemoteCatalogApplyLedger.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    await this.db.mcpRemoteCatalogApplyLedger.create({
      data: {
        tenantId: input.result.tenantId,
        workspaceId: input.result.workspaceId,
        mcpServerId: input.result.serverId,
        idempotencyKey: hashOrSha256(input.idempotencyKey),
        ...data,
      },
    });
  }

  async recordAuditEvent(input: {
    type: string;
    tenantId: string;
    workspaceId: string;
    serverId: string;
    event: McpRemoteCatalogImportApplyAuditEvent;
  }): Promise<void> {
    const event = sanitizeAuditEvent(input.event);

    await this.auditWriter.record({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorUserId: event.approvedByUserId,
      action: event.type,
      entity: 'mcp_remote_catalog_import_apply',
      entityId: input.serverId,
      event,
    });
  }

  private requireApplyContext(context?: McpRemoteCatalogApplyMutationContext): McpRemoteCatalogApplyMutationContext {
    if (!context) throw new McpRemoteCatalogApplyConflictError('apply context is required for real catalog persistence.');
    return context;
  }

  private async assertServerScope(tenantId: string, workspaceId: string, serverId: string) {
    const server = await this.db.mcpServer.findFirst({
      where: {
        id: serverId,
        tenantId,
        workspaceId,
      },
      select: { id: true },
    });
    if (!server) throw new McpRemoteCatalogApplyConflictError('MCP server was not found in tenant/workspace scope.');
  }
}
