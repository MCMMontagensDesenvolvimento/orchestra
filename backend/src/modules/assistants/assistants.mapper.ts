import type {
  Assistant,
  AssistantApprovalRequest,
  AssistantExecutionPolicy,
  AssistantFeedback,
  AssistantPublication,
  AssistantShare,
  AssistantTestResult,
  AssistantVersion,
} from '@prisma/client';
import { responseScopeModeFromMetadata } from '../../shared/policies/response-scope';

type UserIdentity = {
  id: string;
  name: string;
  email: string;
};

type AssistantVersionWithCreator = AssistantVersion & {
  createdBy: UserIdentity;
};

type AssistantApprovalRequestWithActors = AssistantApprovalRequest & {
  requestedBy: UserIdentity;
  decidedBy: UserIdentity | null;
};

export function mapAssistant(
  assistant: Assistant & {
    versions?: AssistantVersionWithCreator[];
    shares?: AssistantShare[];
    publications?: AssistantPublication[];
    executionPolicy?: AssistantExecutionPolicy | null;
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
      createdBy: version.createdBy,
      createdAt: version.createdAt.toISOString(),
      publishedAt: version.publishedAt?.toISOString() ?? null,
      archivedAt: version.archivedAt?.toISOString() ?? null,
    })),
    activePublication: activePublication ? mapAssistantPublication(activePublication) : null,
    publications: assistant.publications?.map(mapAssistantPublication),
    executionPolicy: assistant.executionPolicy ? mapAssistantExecutionPolicy(assistant.executionPolicy) : undefined,
    shares: assistant.shares?.map(mapAssistantShare),
  };
}

export function mapAssistantVersion(version: AssistantVersionWithCreator) {
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
    createdBy: version.createdBy,
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

export function mapAssistantApprovalRequest(approval: AssistantApprovalRequestWithActors) {
  return {
    id: approval.id,
    tenantId: approval.tenantId,
    workspaceId: approval.workspaceId,
    assistantId: approval.assistantId,
    assistantVersionId: approval.assistantVersionId,
    publicationId: approval.publicationId,
    requestedById: approval.requestedById,
    requestedBy: approval.requestedBy,
    decidedById: approval.decidedById,
    decidedBy: approval.decidedBy,
    action: approval.action,
    status: approval.status,
    reason: approval.reason,
    decisionReason: approval.decisionReason,
    metadata: approval.metadata,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
    decidedAt: approval.decidedAt?.toISOString() ?? null,
    cancelledAt: approval.cancelledAt?.toISOString() ?? null,
  };
}

export function mapAssistantExecutionPolicy(policy: AssistantExecutionPolicy) {
  return {
    id: policy.id,
    tenantId: policy.tenantId,
    workspaceId: policy.workspaceId,
    assistantId: policy.assistantId,
    executionMode: policy.executionMode,
    requiresApprovalToPublish: policy.requiresApprovalToPublish,
    sandboxEnabled: policy.sandboxEnabled,
    sandboxRequiresAuth: policy.sandboxRequiresAuth,
    sandboxAllowedForRoles: policy.sandboxAllowedForRoles,
    sandboxBlocksExternalTools: policy.sandboxBlocksExternalTools,
    sandboxBlocksRealProviders: policy.sandboxBlocksRealProviders,
    allowExternalLlmProviders: policy.allowExternalLlmProviders,
    allowedLlmProviders: policy.allowedLlmProviders,
    defaultLlmProvider: policy.defaultLlmProvider,
    sandboxLogsRequired: policy.sandboxLogsRequired,
    sandboxCostLimitPlaceholder: policy.sandboxCostLimitPlaceholder?.toNumber() ?? null,
    allowDraftTesting: policy.allowDraftTesting,
    allowPublishedExecution: policy.allowPublishedExecution,
    isExecutionEnabled: policy.isExecutionEnabled,
    metadata: policy.metadata,
    responseScopeMode: responseScopeModeFromMetadata(policy.metadata),
    updatedById: policy.updatedById,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}
