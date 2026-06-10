import type {
  Assistant,
  AssistantFeedback,
  AssistantPublication,
  AssistantShare,
  AssistantTestResult,
  AssistantVersion,
} from '@prisma/client';

export function mapAssistant(
  assistant: Assistant & {
    versions?: AssistantVersion[];
    shares?: AssistantShare[];
    publications?: AssistantPublication[];
    createdBy?: { id: string; name: string; email: string };
  },
) {
  const activePublication = assistant.publications?.find((publication) => publication.status === 'active') ?? null;

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
      description: version.description,
      instructions: version.instructions,
      modelProvider: version.modelProvider,
      modelName: version.modelName,
      temperature: version.temperature?.toNumber() ?? null,
      configuration: version.configuration,
      createdById: version.createdById,
      createdAt: version.createdAt.toISOString(),
      publishedAt: version.publishedAt?.toISOString() ?? null,
      archivedAt: version.archivedAt?.toISOString() ?? null,
    })),
    activePublication: activePublication ? mapAssistantPublication(activePublication) : null,
    publications: assistant.publications?.map(mapAssistantPublication),
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
    description: version.description,
    instructions: version.instructions,
    modelProvider: version.modelProvider,
    modelName: version.modelName,
    temperature: version.temperature?.toNumber() ?? null,
    configuration: version.configuration,
    createdById: version.createdById,
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
    archivedAt: version.archivedAt?.toISOString() ?? null,
  };
}

export function mapAssistantShare(share: AssistantShare) {
  return {
    id: share.id,
    assistantId: share.assistantId,
    tenantId: share.tenantId,
    workspaceId: share.workspaceId,
    shareType: share.shareType,
    targetId: share.targetId,
    targetType: share.targetType,
    targetUserId: share.targetUserId,
    targetWorkspaceId: share.targetWorkspaceId,
    targetRoleId: share.targetRoleId,
    permission: share.permission,
    createdById: share.createdById,
    createdAt: share.createdAt.toISOString(),
  };
}

export function mapAssistantPublication(publication: AssistantPublication) {
  return {
    id: publication.id,
    tenantId: publication.tenantId,
    workspaceId: publication.workspaceId,
    assistantId: publication.assistantId,
    assistantVersionId: publication.assistantVersionId,
    status: publication.status,
    publishedById: publication.publishedById,
    publishedAt: publication.publishedAt.toISOString(),
    unpublishedById: publication.unpublishedById,
    unpublishedAt: publication.unpublishedAt?.toISOString() ?? null,
    rollbackFromPublicationId: publication.rollbackFromPublicationId,
    rollbackReason: publication.rollbackReason,
    createdAt: publication.createdAt.toISOString(),
    updatedAt: publication.updatedAt.toISOString(),
  };
}

export function mapAssistantFeedback(feedback: AssistantFeedback) {
  return {
    id: feedback.id,
    tenantId: feedback.tenantId,
    workspaceId: feedback.workspaceId,
    assistantId: feedback.assistantId,
    assistantVersionId: feedback.assistantVersionId,
    conversationId: feedback.conversationId,
    messageId: feedback.messageId,
    userId: feedback.userId,
    rating: feedback.rating,
    comment: feedback.comment,
    createdAt: feedback.createdAt.toISOString(),
  };
}

export function mapAssistantTestResult(result: AssistantTestResult) {
  return {
    id: result.id,
    tenantId: result.tenantId,
    workspaceId: result.workspaceId,
    assistantId: result.assistantId,
    assistantVersionId: result.assistantVersionId,
    testedById: result.testedById,
    input: result.input,
    expectedBehavior: result.expectedBehavior,
    actualOutput: result.actualOutput,
    status: result.status,
    score: result.score,
    notes: result.notes,
    createdAt: result.createdAt.toISOString(),
  };
}
