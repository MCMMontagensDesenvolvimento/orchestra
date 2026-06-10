import type { Assistant, AssistantShare, AssistantVersion } from '@prisma/client';

export function mapAssistant(
  assistant: Assistant & {
    versions?: AssistantVersion[];
    shares?: AssistantShare[];
    createdBy?: { id: string; name: string; email: string };
  },
) {
  return {
    id: assistant.id,
    tenantId: assistant.tenantId,
    workspaceId: assistant.workspaceId,
    name: assistant.name,
    description: assistant.description,
    status: assistant.status,
    createdById: assistant.createdById,
    createdAt: assistant.createdAt.toISOString(),
    updatedAt: assistant.updatedAt.toISOString(),
    deletedAt: assistant.deletedAt?.toISOString() ?? null,
    createdBy: assistant.createdBy,
    versions: assistant.versions?.map((version) => ({
      id: version.id,
      assistantId: version.assistantId,
      version: version.version,
      status: version.status,
      displayName: version.displayName,
      instructions: version.instructions,
      modelProvider: version.modelProvider,
      modelName: version.modelName,
      temperature: version.temperature?.toNumber() ?? null,
      createdById: version.createdById,
      createdAt: version.createdAt.toISOString(),
      publishedAt: version.publishedAt?.toISOString() ?? null,
    })),
    shares: assistant.shares?.map(mapAssistantShare),
  };
}

export function mapAssistantVersion(version: AssistantVersion) {
  return {
    id: version.id,
    assistantId: version.assistantId,
    version: version.version,
    status: version.status,
    displayName: version.displayName,
    instructions: version.instructions,
    modelProvider: version.modelProvider,
    modelName: version.modelName,
    temperature: version.temperature?.toNumber() ?? null,
    createdById: version.createdById,
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
  };
}

export function mapAssistantShare(share: AssistantShare) {
  return {
    id: share.id,
    assistantId: share.assistantId,
    shareType: share.shareType,
    targetId: share.targetId,
    createdAt: share.createdAt.toISOString(),
  };
}
