import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import type { AiObservabilityRepository, NormalizedAiUsageEventInput } from './ai-observability.types';

function jsonInput(value: unknown) {
  return value as Prisma.InputJsonValue | undefined;
}

export const aiObservabilityRepository: AiObservabilityRepository = {
  createUsageEvent(input: NormalizedAiUsageEventInput) {
    return prisma.aiRunUsageEvent.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        assistantId: input.assistantId ?? undefined,
        userId: input.userId ?? undefined,
        runId: input.runId,
        traceId: input.traceId ?? undefined,
        source: input.source,
        operation: input.operation,
        provider: input.provider ?? undefined,
        modelName: input.model ?? undefined,
        status: input.status,
        blockedReason: input.blockedReason ?? undefined,
        errorCode: input.errorCode ?? undefined,
        errorMessageHash: input.errorMessageHash ?? undefined,
        inputTokens: input.inputTokens ?? undefined,
        outputTokens: input.outputTokens ?? undefined,
        totalTokens: input.totalTokens ?? undefined,
        embeddingTokens: input.embeddingTokens ?? undefined,
        cachedTokens: input.cachedTokens ?? undefined,
        latencyMs: input.latencyMs ?? undefined,
        costCurrency: input.costCurrency ?? undefined,
        estimatedCostMinorUnits: input.estimatedCostMinorUnits ?? undefined,
        metadata: jsonInput(input.metadata),
        startedAt: input.startedAt,
        completedAt: input.completedAt ?? undefined,
      },
    });
  },
};
