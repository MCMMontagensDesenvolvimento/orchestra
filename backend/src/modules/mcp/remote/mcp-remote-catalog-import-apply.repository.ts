import type { Prisma } from '@prisma/client';
import { recordAuditEvent as writeAuditEvent } from '../../audit/audit.service';
import type {
  McpRemoteCatalogImportApplyAuditEvent,
  McpRemoteCatalogImportApplyCatalogItem,
  McpRemoteCatalogImportApplyRepository,
  McpRemoteCatalogImportApplyTransaction,
} from './mcp-remote.types';

export const MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY = 'MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY';

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

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;

  if (typeof value === 'string') {
    return containsUnsafeText(value) ? '[redacted]' : value.slice(0, 300);
  }

  if (depth >= 4) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeAuditValue(item, depth + 1));
  }

  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isUnsafeKey(key))
      .slice(0, 40)
      .map(([key, item]) => [key, sanitizeAuditValue(item, depth + 1)]),
  );
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
    super(`${MCP_REMOTE_CATALOG_PERSISTENCE_NOT_READY}: ${operation} requires catalog schema support planned for a future phase.`);
    this.name = 'McpRemoteCatalogPersistenceNotReadyError';
  }
}

/**
 * Phase 11G fail-closed adapter.
 *
 * The current catalog has no durable externalName, draft/deprecated lifecycle,
 * catalog hash or idempotency key. Encoding those invariants only in public
 * metadata would not provide safe identity or concurrency guarantees.
 */
export class McpRemoteCatalogImportApplyPersistenceRepository implements McpRemoteCatalogImportApplyRepository {
  constructor(private readonly auditWriter: McpRemoteCatalogImportApplyAuditWriter = defaultAuditWriter) {}

  async withTransaction<T>(fn: (transaction: McpRemoteCatalogImportApplyTransaction) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async findByExternalName(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['findByExternalName']>[0],
  ): Promise<McpRemoteCatalogImportApplyCatalogItem | null> {
    void input;
    return null;
  }

  async createToolDraft(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['createToolDraft']>[0],
  ): Promise<never> {
    void input;
    throw new McpRemoteCatalogPersistenceNotReadyError('create_tool_draft');
  }

  async updateToolDraft(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['updateToolDraft']>[0],
  ): Promise<never> {
    void input;
    throw new McpRemoteCatalogPersistenceNotReadyError('update_tool_draft');
  }

  async deprecateToolDraft(
    input: Parameters<McpRemoteCatalogImportApplyTransaction['deprecateToolDraft']>[0],
  ): Promise<never> {
    void input;
    throw new McpRemoteCatalogPersistenceNotReadyError('deprecate_tool_draft');
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
}
