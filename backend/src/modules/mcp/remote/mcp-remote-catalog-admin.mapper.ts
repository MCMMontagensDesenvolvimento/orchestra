import type {
  McpRemoteCatalogApplyLedgerDetailRecord,
  McpRemoteCatalogApplyLedgerListRecord,
  McpRemoteCatalogEntryDetailRecord,
  McpRemoteCatalogEntryListRecord,
} from './mcp-remote-catalog-admin.repository';

const unsafeKeyFragments = [
  'apikey',
  'authorization',
  'baseurl',
  'cookie',
  'credential',
  'header',
  'password',
  'privatekey',
  'secret',
  'secretref',
  'token',
];

const sensitiveTextPattern = /(?:\bBearer\s+\S+|sk-[A-Za-z0-9]+|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;
const maxStringChars = 500;
const maxArrayItems = 40;
const maxObjectKeys = 60;
const maxDepth = 5;

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

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return containsUnsafeText(value) ? '[redacted]' : value.slice(0, maxStringChars);
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return undefined;
  if (depth >= maxDepth) return '[truncated]';

  if (Array.isArray(value)) {
    return value
      .slice(0, maxArrayItems)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => typeof item !== 'undefined');
  }

  if (!isRecord(value)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort().slice(0, maxObjectKeys)) {
    if (isUnsafeKey(key)) continue;
    const sanitizedValue = sanitizeJsonValue(value[key], depth + 1);
    if (typeof sanitizedValue !== 'undefined') sanitized[key] = sanitizedValue;
  }
  return sanitized;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function jsonSummary(value: unknown) {
  if (value == null) {
    return {
      present: false,
      type: 'null',
      topLevelKeys: [],
      sizeBytes: 0,
    };
  }

  const topLevelKeys = isRecord(value)
    ? Object.keys(value)
        .filter((key) => !isUnsafeKey(key))
        .sort()
        .slice(0, 20)
    : [];

  let sizeBytes = 0;
  try {
    sizeBytes = Buffer.byteLength(JSON.stringify(sanitizeJsonValue(value)), 'utf8');
  } catch {
    sizeBytes = 0;
  }

  return {
    present: true,
    type: Array.isArray(value) ? 'array' : typeof value,
    topLevelKeys,
    sizeBytes,
  };
}

function summaryRecord(value: unknown) {
  if (!isRecord(value)) return null;
  const summary: Record<string, number> = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (typeof item === 'number' && Number.isFinite(item) && !isUnsafeKey(key)) summary[key] = item;
  }
  return summary;
}

function operationPayload(value: unknown) {
  if (!isRecord(value)) {
    return {
      appliedAt: null,
      operationResults: [],
      rollbackNotes: [],
      sanitizedMetadata: {},
      auditEventMetadata: {},
      schemaVersion: null,
    };
  }

  return {
    appliedAt: typeof value.appliedAt === 'string' ? value.appliedAt : null,
    operationResults: sanitizeJsonValue(Array.isArray(value.operationResults) ? value.operationResults : []),
    rollbackNotes: sanitizeJsonValue(Array.isArray(value.rollbackNotes) ? value.rollbackNotes : []),
    sanitizedMetadata: sanitizeJsonValue(isRecord(value.sanitizedMetadata) ? value.sanitizedMetadata : {}),
    auditEventMetadata: sanitizeJsonValue(isRecord(value.auditEventMetadata) ? value.auditEventMetadata : {}),
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : null,
  };
}

function mapEntryBase(entry: McpRemoteCatalogEntryListRecord) {
  return {
    id: entry.id,
    tenantId: entry.tenantId,
    workspaceId: entry.workspaceId,
    serverId: entry.mcpServerId,
    externalName: entry.externalName,
    displayName: entry.displayName,
    description: entry.description,
    source: entry.source,
    lifecycleStatus: entry.lifecycleStatus,
    riskLevel: entry.riskLevel,
    requiresApproval: entry.requiresApproval,
    specHash: entry.specHash,
    catalogHash: entry.catalogHash,
    policy: {
      allowRuntimeExecution: entry.allowRuntimeExecution,
      sandboxOnly: entry.sandboxOnly,
      blockedByDefault: entry.blockedByDefault,
      approvalMode: entry.approvalMode,
      runtimeEnabled: entry.runtimeEnabled,
      remoteExecutionEnabled: entry.remoteExecutionEnabled,
    },
    snapshot: {
      snapshotId: entry.snapshotId,
      snapshotHash: entry.snapshotHash,
    },
    lastPlan: {
      planId: entry.lastPlanId,
      planHash: entry.lastPlanHash,
    },
    lastApply: {
      applyId: entry.lastApplyId,
      applyHash: entry.lastApplyHash,
    },
    revision: entry.revision,
    importedByUserId: entry.importedByUserId,
    importedAt: entry.importedAt.toISOString(),
    approvedByUserId: entry.approvedByUserId,
    approvedAt: iso(entry.approvedAt),
    deprecatedByUserId: entry.deprecatedByUserId,
    deprecatedAt: iso(entry.deprecatedAt),
    deprecationReasonHash: entry.deprecationReasonHash,
    materialization: {
      isMaterialized: Boolean(entry.materializedMcpToolId),
    },
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    deletedAt: iso(entry.deletedAt),
  };
}

export function mapMcpRemoteCatalogEntryList(entry: McpRemoteCatalogEntryListRecord) {
  return mapEntryBase(entry);
}

export function mapMcpRemoteCatalogEntryDetail(entry: McpRemoteCatalogEntryDetailRecord) {
  return {
    ...mapEntryBase(entry),
    schemas: {
      input: sanitizeJsonValue(entry.inputSchema),
      output: sanitizeJsonValue(entry.outputSchema),
      summary: {
        input: jsonSummary(entry.inputSchema),
        output: jsonSummary(entry.outputSchema),
      },
    },
  };
}

function mapLedgerBase(ledger: McpRemoteCatalogApplyLedgerListRecord) {
  return {
    id: ledger.id,
    tenantId: ledger.tenantId,
    workspaceId: ledger.workspaceId,
    serverId: ledger.mcpServerId,
    planId: ledger.planId,
    planHash: ledger.planHash,
    snapshotHash: ledger.snapshotHash,
    applyId: ledger.applyId,
    applyHash: ledger.applyHash,
    approvedByUserId: ledger.approvedByUserId,
    status: ledger.status,
    summary: summaryRecord(ledger.summary),
    schemaVersion: ledger.schemaVersion,
    createdAt: ledger.createdAt.toISOString(),
    completedAt: iso(ledger.completedAt),
  };
}

export function mapMcpRemoteCatalogApplyLedgerList(ledger: McpRemoteCatalogApplyLedgerListRecord) {
  return mapLedgerBase(ledger);
}

export function mapMcpRemoteCatalogApplyLedgerDetail(ledger: McpRemoteCatalogApplyLedgerDetailRecord) {
  return {
    ...mapLedgerBase(ledger),
    idempotencyKey: ledger.idempotencyKey,
    approvalReasonHash: ledger.approvalReasonHash,
    operationResults: operationPayload(ledger.operationResults),
  };
}
