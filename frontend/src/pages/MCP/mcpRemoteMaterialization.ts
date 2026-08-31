import type { McpRemoteCatalogEntry } from '@/services/mcp.service';

export function isMcpRemoteCatalogEntryMaterializable(
  entry: McpRemoteCatalogEntry | null | undefined,
) {
  if (!entry) return false;

  return (
    entry.deletedAt === null
    && entry.lifecycleStatus === 'approved_for_catalog'
    && entry.approvedAt !== null
    && entry.requiresApproval === true
    && entry.materialization.isMaterialized === false
    && entry.policy.allowRuntimeExecution === false
    && entry.policy.sandboxOnly === true
    && entry.policy.blockedByDefault === true
    && entry.policy.approvalMode === 'manual'
    && entry.policy.runtimeEnabled === false
    && entry.policy.remoteExecutionEnabled === false
  );
}

export function remoteMaterializationSummary(
  entries: McpRemoteCatalogEntry[],
) {
  if (entries.length === 0) return 'Não realizada';

  const materialized = entries.filter(
    (entry) => entry.materialization.isMaterialized,
  ).length;

  if (entries.length === 1) {
    return materialized === 1 ? 'Materializada' : 'Não realizada';
  }

  return `${materialized} de ${entries.length} materializadas`;
}
