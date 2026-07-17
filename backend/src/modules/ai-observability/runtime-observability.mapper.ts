import type {
  RuntimeRagQueryRecord,
  RuntimeRunDetailRow,
  RuntimeRunListRow,
  RuntimeUsageRecord,
} from './runtime-observability.repository';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function safeString(value: unknown, maxLength = 160) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function firstPresent<T>(...values: Array<T | null | undefined>): T | null {
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function observationFrom(row: RuntimeRunListRow) {
  const runtime = asRecord(asRecord(row.run.metadata)?.runtime);
  const adapter = asRecord(runtime?.adapterMetadata);
  const llm = asRecord(adapter?.llm);
  const persistedUsage = row.usage;
  const metadataUsage = asRecord(runtime?.usage);

  return {
    runtimeProvider: firstPresent(safeString(runtime?.provider, 80), safeString(persistedUsage?.provider, 80)),
    llmProvider: firstPresent(
      safeString(adapter?.llmProvider, 80),
      safeString(llm?.provider, 80),
      safeString(row.run.assistantVersion?.modelProvider, 80),
    ),
    model: firstPresent(
      safeString(adapter?.llmModel, 160),
      safeString(llm?.model, 160),
      safeString(persistedUsage?.modelName, 160),
      safeString(row.run.assistantVersion?.modelName, 160),
    ),
    responseScopeMode: safeString(runtime?.responseScopeMode, 40),
    ragMode: safeString(runtime?.ragMode, 80),
    ragSourceCount: safeNumber(runtime?.ragSourceCount),
    ragIntentDetected: safeBoolean(runtime?.ragIntentDetected),
    ragSkippedReason: safeString(runtime?.ragSkippedReason, 160),
    fallbackOutsideKnowledgeUsed: safeBoolean(runtime?.fallbackOutsideKnowledgeUsed),
    rawContentLogged: safeBoolean(runtime?.rawContentLogged),
    externalProviderCalled: firstPresent(
      safeBoolean(runtime?.externalProviderCalled),
      safeBoolean(adapter?.externalProviderCalled),
      safeBoolean(llm?.externalProviderCalled),
    ),
    externalMcpCalled: safeBoolean(runtime?.externalMcpCalled),
    toolCallsExecuted: safeNumber(runtime?.toolCallsExecuted),
    latencyMs: firstPresent(
      safeNumber(runtime?.latencyMs),
      safeNumber(adapter?.llmLatencyMs),
      persistedUsage?.latencyMs,
    ),
    inputTokens: firstPresent(persistedUsage?.inputTokens, safeNumber(metadataUsage?.inputTokens)),
    outputTokens: firstPresent(persistedUsage?.outputTokens, safeNumber(metadataUsage?.outputTokens)),
    totalTokens: firstPresent(persistedUsage?.totalTokens, safeNumber(metadataUsage?.totalTokens)),
    cost: mapCost(persistedUsage),
  };
}

function mapCost(usage: RuntimeUsageRecord | null) {
  if (!usage?.costCurrency || usage.estimatedCostMinorUnits === null) return null;
  return {
    currency: usage.costCurrency,
    estimatedMinorUnits: usage.estimatedCostMinorUnits.toString(),
  };
}

function mapRunBase(row: RuntimeRunListRow) {
  return {
    runId: row.run.id,
    assistantId: row.run.assistantId,
    assistantName: safeString(row.run.assistant.name, 160),
    assistantVersionId: row.run.assistantVersionId,
    assistantVersion: safeString(row.run.assistantVersion?.version, 80),
    status: row.run.status,
    mode: row.run.mode,
    inputSummary: safeString(row.run.inputSummary, 500),
    requestId: safeString(row.run.requestId, 160),
    traceId: safeString(row.run.traceId, 160),
    startedAt: iso(row.run.startedAt),
    completedAt: iso(row.run.completedAt),
    createdAt: row.run.createdAt.toISOString(),
    ...observationFrom(row),
  };
}

export function mapRuntimeRunSummary(row: RuntimeRunListRow) {
  return mapRunBase(row);
}

function mapEventMetadata(value: unknown) {
  const metadata = asRecord(value);
  const usage = asRecord(metadata?.usage);
  const mapped = {
    runtimeProvider: safeString(metadata?.provider, 80),
    llmProvider: safeString(metadata?.llmProvider, 80),
    model: safeString(metadata?.model, 160),
    responseScopeMode: safeString(metadata?.responseScopeMode, 40),
    ragMode: safeString(metadata?.ragMode, 80),
    ragSourceCount: safeNumber(metadata?.ragSourceCount),
    ragIntentDetected: safeBoolean(metadata?.ragIntentDetected),
    ragSkippedReason: safeString(metadata?.ragSkippedReason, 160),
    fallbackOutsideKnowledgeUsed: safeBoolean(metadata?.fallbackOutsideKnowledgeUsed),
    rawContentLogged: safeBoolean(metadata?.rawContentLogged),
    externalProviderCalled: firstPresent(
      safeBoolean(metadata?.externalProviderCalled),
      safeBoolean(metadata?.externalProvidersCalled),
    ),
    externalMcpCalled: safeBoolean(metadata?.externalMcpCalled),
    toolCallsExecuted: safeNumber(metadata?.toolCallsExecuted),
    latencyMs: firstPresent(safeNumber(metadata?.latencyMs), safeNumber(metadata?.llmLatencyMs)),
    inputTokens: firstPresent(safeNumber(metadata?.inputTokens), safeNumber(usage?.inputTokens)),
    outputTokens: firstPresent(safeNumber(metadata?.outputTokens), safeNumber(usage?.outputTokens)),
    totalTokens: firstPresent(safeNumber(metadata?.totalTokens), safeNumber(usage?.totalTokens)),
  };
  return Object.fromEntries(Object.entries(mapped).filter(([, item]) => item !== null));
}

function mapRagSource(query: RuntimeRagQueryRecord, result: RuntimeRagQueryRecord['results'][number]) {
  const metadata = asRecord(result.metadata);
  return {
    ragQueryId: query.id,
    rank: result.rank,
    documentTitle: safeString(result.document.title, 200),
    sourceLabel: firstPresent(
      safeString(result.sourceReference?.label, 200),
      safeString(metadata?.sourceReferenceLabel, 200),
      safeString(result.citationLabel, 120),
    ),
    matchType: safeString(result.matchType, 80),
    score: Number.isFinite(result.score) ? result.score : null,
    excerpt: safeString(result.excerpt, 240),
  };
}

export function mapRuntimeRunDetail(row: RuntimeRunDetailRow) {
  const base = mapRunBase({ run: row.run, usage: row.usage });
  const latestRagQuery = row.ragQueries[0];
  return {
    ...base,
    ragQueryId: latestRagQuery?.id ?? null,
    ragMode: base.ragMode ?? latestRagQuery?.mode ?? null,
    ragSourceCount: base.ragSourceCount ?? latestRagQuery?.resultCount ?? null,
    ragQueries: row.ragQueries.map((query) => ({
      id: query.id,
      mode: safeString(query.mode, 80),
      status: safeString(query.status, 40),
      resultCount: query.resultCount,
      createdAt: query.createdAt.toISOString(),
    })),
    ragSources: row.ragQueries.flatMap((query) => query.results.map((result) => mapRagSource(query, result))),
    events: row.run.events.map((event) => ({
      id: event.id,
      type: safeString(event.type, 120),
      sequence: event.sequence,
      status: safeString(event.status, 40),
      metadata: mapEventMetadata(event.metadata),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export function mapRuntimeSummary(record: Awaited<ReturnType<import('./runtime-observability.repository').RuntimeObservabilityPersistenceRepository['summarizeRuntime']>>) {
  const statusCounts = Object.fromEntries(
    record.statusGroups.map((group) => [group.status, group._count._all]),
  );
  return {
    totalRuns: record.totalRuns,
    completedRuns: statusCounts.completed ?? 0,
    failedRuns: statusCounts.failed ?? 0,
    blockedRuns: statusCounts.blocked ?? 0,
    runningRuns: statusCounts.running ?? 0,
    successRate: record.totalRuns > 0
      ? Number((((statusCounts.completed ?? 0) / record.totalRuns) * 100).toFixed(1))
      : null,
    avgLatencyMs: record.usage._avg.latencyMs === null
      ? null
      : Number(record.usage._avg.latencyMs.toFixed(1)),
    totalTokens: record.usage._sum.totalTokens === null
      ? null
      : String(record.usage._sum.totalTokens),
  };
}
