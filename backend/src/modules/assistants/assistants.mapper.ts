import type { Assistant, AssistantVersion } from '@prisma/client';

export function mapAssistant(assistant: Assistant & { versions?: AssistantVersion[] }) {
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
    versions: assistant.versions?.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      displayName: version.displayName,
      modelProvider: version.modelProvider,
      modelName: version.modelName,
      temperature: version.temperature?.toNumber() ?? null,
      createdById: version.createdById,
      createdAt: version.createdAt.toISOString(),
      publishedAt: version.publishedAt?.toISOString() ?? null,
    })),
  };
}
