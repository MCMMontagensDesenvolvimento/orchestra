import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { agentRunsRepository } from '../agent-runs/agent-runs.repository';
import type { AgentRunMode } from '../agent-runs/agent-runs.schema';
import type { AgentRunPrecheckSnapshot } from '../agent-runs/agent-runs.types';
import type { LlmProviderName } from '../llm/llm.types';
import type { RuntimeExecutionContext, RuntimeMcpSummary, RuntimeProvider, RuntimeRagSummary } from './runtime.types';

type RuntimeSummary = Awaited<ReturnType<typeof agentRunsRepository.getRuntimeContextSummary>>;

interface BuildRuntimeContextInput {
  requestId: string;
  traceId: string;
  runId: string;
  userId: string;
  tenantId: string;
  workspaceId: string;
  assistant: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    versions: Array<{
      id: string;
      instructions: string | null;
      displayName?: string | null;
      modelProvider?: string | null;
      modelName?: string | null;
      temperature?: { toString(): string } | number | string | null;
    }>;
  };
  assistantVersionId: string | null;
  assistantPublicationId: string | null;
  executionMode: AgentRunMode;
  provider: RuntimeProvider;
  input: string;
  executionPolicy: Record<string, unknown>;
  precheckSnapshot: AgentRunPrecheckSnapshot;
  metadata?: Prisma.InputJsonValue;
}

function previewInput(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function previewText(value: string | null | undefined, maxChars: number) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function hashInput(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function llmProviderArray(value: unknown): LlmProviderName[] {
  return stringArray(value).filter((item): item is LlmProviderName => item === 'openai');
}

function llmProviderValue(value: unknown): LlmProviderName | null {
  return value === 'openai' ? value : null;
}

function policySnapshot(policy: Record<string, unknown>): Prisma.InputJsonValue {
  return {
    executionMode: String(policy.executionMode ?? 'sandbox'),
    sandboxEnabled: Boolean(policy.sandboxEnabled),
    sandboxBlocksExternalTools: Boolean(policy.sandboxBlocksExternalTools),
    sandboxBlocksRealProviders: Boolean(policy.sandboxBlocksRealProviders),
    sandboxLogsRequired: Boolean(policy.sandboxLogsRequired),
    allowDraftTesting: Boolean(policy.allowDraftTesting),
    allowPublishedExecution: Boolean(policy.allowPublishedExecution),
    isExecutionEnabled: Boolean(policy.isExecutionEnabled),
    allowExternalLlmProviders: Boolean(policy.allowExternalLlmProviders),
    allowedLlmProviders: llmProviderArray(policy.allowedLlmProviders),
    defaultLlmProvider: llmProviderValue(policy.defaultLlmProvider),
  };
}

function decimalToNumber(value: { toString(): string } | number | string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRagSummary(summary: RuntimeSummary): RuntimeRagSummary {
  return {
    ragReady: summary.knowledgeBindingsCount > 0 && summary.chunkCount > 0,
    knowledgeBindingsCount: summary.knowledgeBindingsCount,
    chunkCount: summary.chunkCount,
    sourceReferenceCount: summary.sourceReferenceCount,
    lastRagQueryId: summary.lastRagQuery?.id ?? null,
    sourceReferences: summary.sourceReferences.map((reference) => ({
      id: reference.id,
      label: reference.label,
      sourceUri: reference.sourceUri,
      documentTitle: reference.document.title,
      excerpt: previewText(reference.chunk?.content, 500),
    })),
  };
}

function buildMcpSummary(summary: RuntimeSummary): RuntimeMcpSummary {
  const allowedSandboxTools: RuntimeMcpSummary['allowedSandboxTools'] = [];
  const blockedTools: RuntimeMcpSummary['blockedTools'] = [];
  const requiresApproval: RuntimeMcpSummary['requiresApproval'] = [];

  for (const binding of summary.mcpBindings) {
    const tool = binding.tool;
    if (!tool) {
      blockedTools.push({ id: binding.id, name: binding.server.name, reason: 'binding_without_tool' });
      continue;
    }
    if (binding.mode === 'disabled') {
      blockedTools.push({ id: tool.id, name: tool.name, reason: 'binding_disabled' });
      continue;
    }
    if (binding.server.deletedAt || binding.server.status !== 'active') {
      blockedTools.push({ id: tool.id, name: tool.name, reason: 'server_not_active' });
      continue;
    }
    if (tool.deletedAt || !tool.isEnabled) {
      blockedTools.push({ id: tool.id, name: tool.name, reason: 'tool_disabled' });
      continue;
    }
    const requiresApprovalForTool = binding.requiresApprovalOverride ?? tool.requiresApproval;
    if (requiresApprovalForTool || tool.riskLevel === 'high' || tool.riskLevel === 'critical') {
      requiresApproval.push({ id: tool.id, name: tool.name, riskLevel: tool.riskLevel });
      continue;
    }
    allowedSandboxTools.push({
      id: binding.id,
      serverId: binding.server.id,
      toolId: tool.id,
      name: tool.name,
      riskLevel: tool.riskLevel,
      requiresApproval: requiresApprovalForTool,
      executionMode: binding.mode,
    });
  }

  return {
    mcpBindingsCount: summary.mcpBindings.length,
    allowedSandboxTools,
    blockedTools,
    requiresApproval,
    lastToolCallIds: summary.lastToolCallIds,
  };
}

export async function buildRuntimeExecutionContext(input: BuildRuntimeContextInput): Promise<RuntimeExecutionContext> {
  const summary = await agentRunsRepository.getRuntimeContextSummary({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    assistantId: input.assistant.id,
  });
  const selectedVersion = input.assistant.versions.find((version) => version.id === input.assistantVersionId) ?? input.assistant.versions[0];

  return {
    requestId: input.requestId,
    traceId: input.traceId,
    runId: input.runId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    assistantId: input.assistant.id,
    assistantVersionId: input.assistantVersionId,
    assistantPublicationId: input.assistantPublicationId,
    executionMode: input.executionMode,
    provider: input.provider,
    assistant: {
      id: input.assistant.id,
      name: input.assistant.name,
      description: input.assistant.description,
      status: input.assistant.status,
      objective: input.assistant.description,
    },
    compiledPrompt: {
      mode: 'placeholder',
      assistantVersionId: selectedVersion?.id ?? null,
      instructionChars: selectedVersion?.instructions?.length ?? 0,
      instructionsPreview: previewText(selectedVersion?.instructions, 1500),
      modelProvider: selectedVersion?.modelProvider ?? null,
      modelName: selectedVersion?.modelName ?? null,
      temperature: decimalToNumber(selectedVersion?.temperature),
    },
    executionPolicySnapshot: policySnapshot(input.executionPolicy),
    llmPolicySnapshot: {
      allowExternalLlmProviders: Boolean(input.executionPolicy.allowExternalLlmProviders),
      allowedLlmProviders: llmProviderArray(input.executionPolicy.allowedLlmProviders),
      defaultLlmProvider: llmProviderValue(input.executionPolicy.defaultLlmProvider),
    },
    precheckSnapshot: input.precheckSnapshot,
    rag: buildRagSummary(summary),
    mcp: buildMcpSummary(summary),
    input: {
      hash: hashInput(input.input),
      preview: previewInput(input.input),
      raw: input.input,
    },
    metadata: input.metadata,
  };
}
