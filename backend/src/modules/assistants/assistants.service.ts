import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import {
  mapAssistant,
  mapAssistantApprovalRequest,
  mapAssistantExecutionPolicy,
  mapAssistantFeedback,
  mapAssistantPublication,
  mapAssistantShare,
  mapAssistantTestResult,
  mapAssistantVersion,
} from './assistants.mapper';
import { assistantPolicies, type AssistantPolicySubject } from './assistants.policy';
import { assistantsRepository } from './assistants.repository';
import type {
  AssistantCreateInput,
  AssistantApprovalCreateInput,
  AssistantApprovalDecisionInput,
  AssistantExecutionPolicyUpdateInput,
  AssistantExecutionPrecheckInput,
  AssistantFeedbackCreateInput,
  AssistantsQuery,
  AssistantPublishInput,
  AssistantRollbackInput,
  AssistantRestoreInput,
  AssistantShareCreateInput,
  AssistantTestResultCreateInput,
  AssistantUpdateInput,
  AssistantVersionCreateInput,
} from './assistants.schema';

interface RequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);
const unsafeMetadataKeys = new Set(['instructions', 'prompt', 'content', 'secret', 'token', 'password', 'apiKey', 'authorization']);

function subjectFromAssistant(assistant: AssistantPolicySubject): AssistantPolicySubject {
  return {
    workspaceId: assistant.workspaceId,
    createdById: assistant.createdById,
    status: assistant.status,
  };
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 30)
      .map(([key, item]) => [
        key,
        unsafeMetadataKeys.has(key) || unsafeMetadataKeys.has(key.toLowerCase()) ? '[redacted]' : sanitizeMetadata(item, depth + 1),
      ]),
  );
}

async function assertApprovedAction(assistantId: string, action: string, approvalId?: string, versionId?: string) {
  if (!approvalId) {
    throw new AppError(409, 'APPROVAL_REQUIRED', 'A acao exige approval aprovado.');
  }
  const approval = await assistantsRepository.findApprovedApproval({ assistantId, approvalId, action });
  if (!approval) {
    throw new AppError(409, 'APPROVAL_NOT_APPROVED', 'Approval aprovado nao encontrado para esta acao.');
  }
  if (versionId && approval.assistantVersionId && approval.assistantVersionId !== versionId) {
    throw new AppError(409, 'APPROVAL_VERSION_MISMATCH', 'Approval aprovado nao corresponde a versao solicitada.');
  }
  return approval;
}

async function recordDenied(
  user: AuthenticatedUser,
  assistant: Pick<AssistantPolicySubject, 'workspaceId'> & { id?: string },
  policy: string,
  context: RequestContext,
) {
  await recordAuditEvent({
    tenantId: user.tenant.id,
    workspaceId: assistant.workspaceId,
    actorUserId: user.id,
    action: 'permission_denied',
    entity: 'assistant',
    entityId: assistant.id,
    metadata: { policy },
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

async function assertAllowed(
  allowed: boolean,
  policy: string,
  user: AuthenticatedUser,
  assistant: Pick<AssistantPolicySubject, 'workspaceId'> & { id?: string },
  context: RequestContext,
) {
  if (allowed) return;
  await recordDenied(user, assistant, policy, context);
  throw new AppError(403, 'FORBIDDEN', 'Permissao insuficiente para esta acao.');
}

async function getAssistantOrThrow(id: string, user: AuthenticatedUser) {
  const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
  if (!assistant) {
    throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
  }
  return assistant;
}

async function resolveVersionOrThrow(assistantId: string, versionId?: string) {
  const version = await assistantsRepository.resolveVersion(assistantId, versionId);
  if (!version) {
    throw new AppError(404, 'ASSISTANT_VERSION_NOT_FOUND', 'Versao do assistente nao encontrada.');
  }
  return version;
}

export const assistantsService = {
  async list(user: AuthenticatedUser, query: AssistantsQuery) {
    const result = await assistantsRepository.list(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAssistant),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string, user: AuthenticatedUser) {
    const assistant = await getAssistantOrThrow(id, user);
    return mapAssistant(assistant);
  },

  async create(input: AssistantCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const workspaceId = input.workspaceId ?? user.workspaces[0]?.id;
    if (!workspaceId || !userWorkspaceIds(user).includes(workspaceId)) {
      await recordAuditEvent({
        tenantId: user.tenant.id,
        workspaceId,
        actorUserId: user.id,
        action: 'permission_denied',
        entity: 'assistant',
        metadata: { policy: 'canCreateAssistant' },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
    }
    await assertAllowed(assistantPolicies.canCreateAssistant(user, workspaceId), 'canCreateAssistant', user, { workspaceId }, context);
    if (input.status === 'published') {
      throw new AppError(422, 'PUBLISH_ACTION_REQUIRED', 'Use o endpoint de publicacao para publicar assistentes.');
    }

    const assistant = await assistantsRepository.create({
      ...input,
      tenantId: user.tenant.id,
      workspaceId,
      createdById: user.id,
    });

    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId,
      actorUserId: user.id,
      action: 'assistant_created',
      entity: 'assistant',
      entityId: assistant.id,
      metadata: { status: assistant.status },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return mapAssistant(assistant);
  },

  async update(id: string, input: AssistantUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canUpdateAssistant(user, subjectFromAssistant(current)),
      'canUpdateAssistant',
      user,
      current,
      context,
    );
    if (input.status === 'published') {
      throw new AppError(422, 'PUBLISH_ACTION_REQUIRED', 'Use o endpoint de publicacao para publicar assistentes.');
    }

    const assistant = await assistantsRepository.update(id, user.tenant.id, userWorkspaceIds(user), input);
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_updated',
      entity: 'assistant',
      entityId: assistant.id,
      metadata: { status: assistant.status },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return mapAssistant(assistant);
  },

  async archive(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canArchiveAssistant(user, subjectFromAssistant(current)),
      'canArchiveAssistant',
      user,
      current,
      context,
    );

    const assistant = await assistantsRepository.archive({
      id,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      actorUserId: user.id,
    });
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_archived',
      entity: 'assistant',
      entityId: assistant.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return mapAssistant(assistant);
  },

  async restore(id: string, input: AssistantRestoreInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canRestoreAssistant(user, subjectFromAssistant(current)),
      'canRestoreAssistant',
      user,
      current,
      context,
    );
    if (input.approvalId) {
      await assertApprovedAction(current.id, 'restore', input.approvalId);
    }

    const assistant = await assistantsRepository.restore(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }

    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_restored',
      entity: 'assistant',
      entityId: assistant.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return mapAssistant(assistant);
  },

  async listVersions(id: string, user: AuthenticatedUser, context?: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    if (context) {
      await assertAllowed(
        assistantPolicies.canReadAssistant(user, subjectFromAssistant(assistant)),
        'canReadAssistant',
        user,
        assistant,
        context,
      );
    }
    const versions = await assistantsRepository.listVersions(assistant.id);
    return versions.map(mapAssistantVersion);
  },

  async createVersion(id: string, input: AssistantVersionCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canUpdateAssistant(user, subjectFromAssistant(assistant)),
      'canUpdateAssistant',
      user,
      assistant,
      context,
    );

    const version = await assistantsRepository.createVersion({
      ...input,
      assistantId: assistant.id,
      createdById: user.id,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_version_created',
      entity: 'assistant_version',
      entityId: version.id,
      metadata: { assistantId: assistant.id, version: version.version },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantVersion(version);
  },

  async getVersion(id: string, versionId: string, user: AuthenticatedUser, context?: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    if (context) {
      await assertAllowed(
        assistantPolicies.canReadAssistant(user, subjectFromAssistant(assistant)),
        'canReadAssistant',
        user,
        assistant,
        context,
      );
    }
    const version = await assistantsRepository.findVersion(assistant.id, versionId);
    if (!version) {
      throw new AppError(404, 'ASSISTANT_VERSION_NOT_FOUND', 'Versao do assistente nao encontrada.');
    }
    return mapAssistantVersion(version);
  },

  async publish(id: string, input: AssistantPublishInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canPublishAssistant(user, subjectFromAssistant(current)),
      'canPublishAssistant',
      user,
      current,
      context,
    );
    const executionPolicy = await assistantsRepository.getExecutionPolicy(current);
    if (executionPolicy.requiresApprovalToPublish && !input.approvalId) {
      await recordAuditEvent({
        tenantId: user.tenant.id,
        workspaceId: current.workspaceId,
        actorUserId: user.id,
        action: 'assistant_publish_blocked_by_approval',
        entity: 'assistant',
        entityId: current.id,
        metadata: { requiresApprovalToPublish: true },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new AppError(409, 'APPROVAL_REQUIRED', 'Publicacao exige approval aprovado.');
    }
    if (executionPolicy.requiresApprovalToPublish) {
      await assertApprovedAction(current.id, 'publish', input.approvalId, input.versionId);
    }

    const result = await assistantsRepository.publish({
      id,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      actorUserId: user.id,
      payload: input,
    });
    if (!result?.assistant) {
      throw new AppError(404, 'ASSISTANT_VERSION_NOT_FOUND', 'Assistente ou versao nao encontrada.');
    }

    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: result.assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_published',
      entity: 'assistant',
      entityId: result.assistant.id,
      metadata: {
        assistantId: result.assistant.id,
        versionId: result.publication.assistantVersionId,
        publicationId: result.publication.id,
        previousPublicationId: result.previousPublication?.id,
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistant(result.assistant);
  },

  async unpublish(id: string, user: AuthenticatedUser, context: RequestContext) {
    const current = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canUnpublishAssistant(user, subjectFromAssistant(current)),
      'canUnpublishAssistant',
      user,
      current,
      context,
    );

    const result = await assistantsRepository.unpublish({
      id,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      actorUserId: user.id,
    });
    if (!result?.assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: result.assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_unpublished',
      entity: 'assistant',
      entityId: result.assistant.id,
      metadata: result.publication
        ? { publicationId: result.publication.id, versionId: result.publication.assistantVersionId }
        : undefined,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistant(result.assistant);
  },

  async rollback(id: string, input: AssistantRollbackInput, user: AuthenticatedUser, context: RequestContext) {
    const current = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canRollbackAssistant(user, subjectFromAssistant(current)),
      'canRollbackAssistant',
      user,
      current,
      context,
    );
    if (input.approvalId) {
      await assertApprovedAction(current.id, 'rollback', input.approvalId, input.versionId);
    }

    const result = await assistantsRepository.rollback({
      id,
      tenantId: user.tenant.id,
      workspaceIds: userWorkspaceIds(user),
      actorUserId: user.id,
      payload: input,
    });
    if (!result?.assistant) {
      throw new AppError(404, 'ASSISTANT_ROLLBACK_TARGET_NOT_FOUND', 'Publicacao ou versao para rollback nao encontrada.');
    }

    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: result.assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_rollback',
      entity: 'assistant',
      entityId: result.assistant.id,
      metadata: {
        assistantId: result.assistant.id,
        versionId: result.publication.assistantVersionId,
        publicationId: result.publication.id,
        rollbackFromPublicationId: result.previousPublication?.id,
        hasReason: Boolean(input.reason),
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistant(result.assistant);
  },

  async listPublications(id: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadPublications(user, subjectFromAssistant(assistant)),
      'canReadPublications',
      user,
      assistant,
      context,
    );
    const publications = await assistantsRepository.listPublications(assistant.id);
    return publications.map(mapAssistantPublication);
  },

  async getActivePublication(id: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadPublications(user, subjectFromAssistant(assistant)),
      'canReadPublications',
      user,
      assistant,
      context,
    );
    const publication = await assistantsRepository.getActivePublication(assistant.id);
    return publication ? mapAssistantPublication(publication) : null;
  },

  async listApprovals(id: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadAssistant(user, subjectFromAssistant(assistant)),
      'canReadAssistant',
      user,
      assistant,
      context,
    );
    const approvals = await assistantsRepository.listApprovals(assistant.id);
    return approvals.map(mapAssistantApprovalRequest);
  },

  async getApproval(id: string, approvalId: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadAssistant(user, subjectFromAssistant(assistant)),
      'canReadAssistant',
      user,
      assistant,
      context,
    );
    const approval = await assistantsRepository.findApproval(assistant.id, approvalId);
    if (!approval) {
      throw new AppError(404, 'ASSISTANT_APPROVAL_NOT_FOUND', 'Approval nao encontrado.');
    }
    return mapAssistantApprovalRequest(approval);
  },

  async createApproval(id: string, input: AssistantApprovalCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canRequestApproval(user, subjectFromAssistant(assistant)),
      'canRequestApproval',
      user,
      assistant,
      context,
    );
    if (input.assistantVersionId) {
      await resolveVersionOrThrow(assistant.id, input.assistantVersionId);
    }
    if (input.publicationId) {
      const publication = await assistantsRepository.findPublication(assistant.id, input.publicationId);
      if (!publication) {
        throw new AppError(404, 'ASSISTANT_PUBLICATION_NOT_FOUND', 'Publicacao nao encontrada.');
      }
    }

    const approval = await assistantsRepository.createApproval({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      requestedById: user.id,
      metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue | undefined,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_approval_requested',
      entity: 'assistant_approval_request',
      entityId: approval.id,
      metadata: {
        assistantId: assistant.id,
        action: approval.action,
        versionId: approval.assistantVersionId,
        publicationId: approval.publicationId,
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantApprovalRequest(approval);
  },

  async approveApproval(id: string, approvalId: string, input: AssistantApprovalDecisionInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canApproveApproval(user, subjectFromAssistant(assistant)),
      'canApproveApproval',
      user,
      assistant,
      context,
    );
    const current = await assistantsRepository.findApproval(assistant.id, approvalId);
    if (!current) {
      throw new AppError(404, 'ASSISTANT_APPROVAL_NOT_FOUND', 'Approval nao encontrado.');
    }
    if (current.status !== 'pending') {
      throw new AppError(409, 'APPROVAL_ALREADY_DECIDED', 'Approval ja foi decidido.');
    }
    const approval = await assistantsRepository.decideApproval({
      assistantId: assistant.id,
      approvalId,
      status: 'approved',
      decidedById: user.id,
      decisionReason: input.decisionReason,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_approval_approved',
      entity: 'assistant_approval_request',
      entityId: approval.id,
      metadata: { assistantId: assistant.id, action: approval.action, requestedById: approval.requestedById },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantApprovalRequest(approval);
  },

  async rejectApproval(id: string, approvalId: string, input: AssistantApprovalDecisionInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canRejectApproval(user, subjectFromAssistant(assistant)),
      'canRejectApproval',
      user,
      assistant,
      context,
    );
    const current = await assistantsRepository.findApproval(assistant.id, approvalId);
    if (!current) {
      throw new AppError(404, 'ASSISTANT_APPROVAL_NOT_FOUND', 'Approval nao encontrado.');
    }
    if (current.status !== 'pending') {
      throw new AppError(409, 'APPROVAL_ALREADY_DECIDED', 'Approval ja foi decidido.');
    }
    const approval = await assistantsRepository.decideApproval({
      assistantId: assistant.id,
      approvalId,
      status: 'rejected',
      decidedById: user.id,
      decisionReason: input.decisionReason,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_approval_rejected',
      entity: 'assistant_approval_request',
      entityId: approval.id,
      metadata: { assistantId: assistant.id, action: approval.action, requestedById: approval.requestedById },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantApprovalRequest(approval);
  },

  async cancelApproval(id: string, approvalId: string, input: AssistantApprovalDecisionInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canCancelApproval(user, subjectFromAssistant(assistant)),
      'canCancelApproval',
      user,
      assistant,
      context,
    );
    const current = await assistantsRepository.findApproval(assistant.id, approvalId);
    if (!current) {
      throw new AppError(404, 'ASSISTANT_APPROVAL_NOT_FOUND', 'Approval nao encontrado.');
    }
    if (current.status !== 'pending') {
      throw new AppError(409, 'APPROVAL_ALREADY_DECIDED', 'Approval ja foi decidido.');
    }
    const approval = await assistantsRepository.cancelApproval({
      assistantId: assistant.id,
      approvalId,
      requestedById: user.id,
      decisionReason: input.decisionReason,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_approval_cancelled',
      entity: 'assistant_approval_request',
      entityId: approval.id,
      metadata: { assistantId: assistant.id, action: approval.action, requestedById: approval.requestedById },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantApprovalRequest(approval);
  },

  async getExecutionPolicy(id: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadAssistant(user, subjectFromAssistant(assistant)),
      'canReadAssistant',
      user,
      assistant,
      context,
    );
    const policy = await assistantsRepository.getExecutionPolicy(assistant);
    return mapAssistantExecutionPolicy(policy);
  },

  async updateExecutionPolicy(id: string, input: AssistantExecutionPolicyUpdateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canConfigureExecutionPolicy(user, subjectFromAssistant(assistant)),
      'canConfigureExecutionPolicy',
      user,
      assistant,
      context,
    );
    if (input.isExecutionEnabled === true) {
      await assertAllowed(
        assistantPolicies.canEnableExecution(user, subjectFromAssistant(assistant)),
        'canEnableExecution',
        user,
        assistant,
        context,
      );
    }
    if (input.sandboxBlocksExternalTools === false || input.sandboxBlocksRealProviders === false) {
      throw new AppError(422, 'REAL_EXECUTION_NOT_AVAILABLE', 'Sandbox deve bloquear tools externas e providers reais nesta fase.');
    }
    if (input.sandboxLogsRequired === false) {
      throw new AppError(422, 'SANDBOX_LOGS_REQUIRED', 'Sandbox deve exigir logs nesta fase.');
    }
    if (assistant.status === 'archived') {
      throw new AppError(422, 'ARCHIVED_ASSISTANT_BLOCKED', 'Assistente arquivado nao pode ter execucao habilitada.');
    }
    if (input.executionMode === 'published' || input.allowPublishedExecution === true) {
      const activePublication = await assistantsRepository.getActivePublication(assistant.id);
      if (!activePublication || assistant.status !== 'published') {
        throw new AppError(422, 'NO_ACTIVE_PUBLICATION', 'Execucao published exige publicacao ativa.');
      }
    }

    const policy = await assistantsRepository.updateExecutionPolicy({
      assistant,
      payload: input,
      updatedById: user.id,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_execution_policy_updated',
      entity: 'assistant_execution_policy',
      entityId: policy.id,
      metadata: {
        assistantId: assistant.id,
        executionMode: policy.executionMode,
        isExecutionEnabled: policy.isExecutionEnabled,
        requiresApprovalToPublish: policy.requiresApprovalToPublish,
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    const sandboxKeys = ['sandboxEnabled', 'sandboxRequiresAuth', 'sandboxAllowedForRoles', 'sandboxBlocksExternalTools', 'sandboxBlocksRealProviders', 'sandboxLogsRequired', 'sandboxCostLimitPlaceholder'];
    if (sandboxKeys.some((key) => key in input)) {
      await recordAuditEvent({
        tenantId: user.tenant.id,
        workspaceId: assistant.workspaceId,
        actorUserId: user.id,
        action: 'assistant_sandbox_policy_updated',
        entity: 'assistant_execution_policy',
        entityId: policy.id,
        metadata: { assistantId: assistant.id, sandboxEnabled: policy.sandboxEnabled },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }
    return mapAssistantExecutionPolicy(policy);
  },

  async executionPrecheck(id: string, input: AssistantExecutionPrecheckInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canRunExecutionPrecheck(user, subjectFromAssistant(assistant)),
      'canRunExecutionPrecheck',
      user,
      assistant,
      context,
    );
    if (input.mode === 'sandbox') {
      await assertAllowed(
        assistantPolicies.canUseSandbox(user, subjectFromAssistant(assistant)),
        'canUseSandbox',
        user,
        assistant,
        context,
      );
    }

    const policy = await assistantsRepository.getExecutionPolicy(assistant);
    const activePublication = await assistantsRepository.getActivePublication(assistant.id);
    const pendingApprovals = await assistantsRepository.countPendingApprovals(assistant.id, ['publish', 'enable_execution']);
    const reasons: { code: string; message: string }[] = [];

    if (assistant.status === 'archived') {
      reasons.push({ code: 'ASSISTANT_ARCHIVED', message: 'Assistente arquivado nao pode executar.' });
    }
    if (input.mode === 'archived') {
      reasons.push({ code: 'MODE_ARCHIVED', message: 'Modo archived e apenas estado de bloqueio, nao modo executavel.' });
    }
    if (input.mode === 'blocked') {
      reasons.push({ code: 'MODE_BLOCKED', message: 'Modo blocked impede execucao.' });
    }
    if (input.mode === 'draft_test' && !policy.allowDraftTesting) {
      reasons.push({ code: 'DRAFT_TESTING_DISABLED', message: 'Testes em draft estao desabilitados pela policy.' });
    }
    if (input.mode === 'sandbox') {
      if (!policy.sandboxEnabled) reasons.push({ code: 'SANDBOX_DISABLED', message: 'Sandbox esta desabilitado pela policy.' });
      if (!policy.sandboxBlocksExternalTools) reasons.push({ code: 'EXTERNAL_TOOLS_NOT_BLOCKED', message: 'Sandbox deve bloquear tools externas nesta fase.' });
      if (!policy.sandboxBlocksRealProviders) reasons.push({ code: 'REAL_PROVIDERS_NOT_BLOCKED', message: 'Sandbox deve bloquear providers reais nesta fase.' });
      if (!policy.sandboxLogsRequired) reasons.push({ code: 'SANDBOX_LOGS_REQUIRED', message: 'Sandbox exige logs para rastreabilidade.' });
    }
    if (input.mode === 'published') {
      if (assistant.status !== 'published') reasons.push({ code: 'ASSISTANT_NOT_PUBLISHED', message: 'Assistente nao esta publicado.' });
      if (!activePublication) reasons.push({ code: 'NO_ACTIVE_PUBLICATION', message: 'O assistente nao possui publicacao ativa.' });
      if (!policy.allowPublishedExecution) reasons.push({ code: 'PUBLISHED_EXECUTION_DISABLED', message: 'Execucao published nao foi liberada pela policy.' });
      if (!policy.isExecutionEnabled) reasons.push({ code: 'EXECUTION_DISABLED', message: 'Execucao esta desabilitada pela policy.' });
      if (pendingApprovals > 0) reasons.push({ code: 'PENDING_APPROVAL', message: 'Ha approval pendente relacionado a publicacao ou execucao.' });
    }

    if (reasons.length > 0) {
      await recordAuditEvent({
        tenantId: user.tenant.id,
        workspaceId: assistant.workspaceId,
        actorUserId: user.id,
        action: 'assistant_execution_blocked',
        entity: 'assistant',
        entityId: assistant.id,
        metadata: { mode: input.mode, reasons: reasons.map((reason) => reason.code) },
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    return {
      canExecute: reasons.length === 0,
      mode: input.mode,
      reasons,
      requestId: context.requestId,
    };
  },

  async listFeedback(id: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadFeedback(user, subjectFromAssistant(assistant)),
      'canReadFeedback',
      user,
      assistant,
      context,
    );
    const feedback = await assistantsRepository.listFeedback(assistant.id);
    return feedback.map(mapAssistantFeedback);
  },

  async createFeedback(id: string, input: AssistantFeedbackCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canCreateFeedback(user, subjectFromAssistant(assistant)),
      'canCreateFeedback',
      user,
      assistant,
      context,
    );
    const version = input.assistantVersionId ? await resolveVersionOrThrow(assistant.id, input.assistantVersionId) : null;
    const feedback = await assistantsRepository.createFeedback({
      ...input,
      assistantVersionId: version?.id,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      userId: user.id,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_feedback_created',
      entity: 'assistant_feedback',
      entityId: feedback.id,
      metadata: { assistantId: assistant.id, versionId: feedback.assistantVersionId, rating: feedback.rating },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantFeedback(feedback);
  },

  async listTestResults(id: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canReadTestResults(user, subjectFromAssistant(assistant)),
      'canReadTestResults',
      user,
      assistant,
      context,
    );
    const results = await assistantsRepository.listTestResults(assistant.id);
    return results.map(mapAssistantTestResult);
  },

  async createTestResult(id: string, input: AssistantTestResultCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canCreateTestResult(user, subjectFromAssistant(assistant)),
      'canCreateTestResult',
      user,
      assistant,
      context,
    );
    const version = await resolveVersionOrThrow(assistant.id, input.assistantVersionId);
    const result = await assistantsRepository.createTestResult({
      ...input,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      assistantId: assistant.id,
      assistantVersionId: version.id,
      testedById: user.id,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_test_result_created',
      entity: 'assistant_test_result',
      entityId: result.id,
      metadata: {
        assistantId: assistant.id,
        versionId: result.assistantVersionId,
        status: result.status,
        score: result.score,
      },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantTestResult(result);
  },

  async listShares(id: string, user: AuthenticatedUser, context?: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    if (context) {
      await assertAllowed(
        assistantPolicies.canReadAssistant(user, subjectFromAssistant(assistant)),
        'canReadAssistant',
        user,
        assistant,
        context,
      );
    }
    const shares = await assistantsRepository.listShares(assistant.id);
    return shares.map(mapAssistantShare);
  },

  async createShare(id: string, input: AssistantShareCreateInput, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canShareAssistant(user, subjectFromAssistant(assistant)),
      'canShareAssistant',
      user,
      assistant,
      context,
    );

    const targetType = input.targetType ?? input.shareType ?? 'workspace';
    const targetUserId = targetType === 'user' ? (input.targetUserId ?? input.targetId ?? undefined) : undefined;
    const targetWorkspaceId = targetType === 'workspace' ? (input.targetWorkspaceId ?? input.targetId ?? undefined) : undefined;
    const targetRoleId = targetType === 'role' ? (input.targetRoleId ?? input.targetId ?? undefined) : undefined;

    if (targetType === 'tenant' && (input.targetId || input.targetUserId || input.targetWorkspaceId || input.targetRoleId)) {
      throw new AppError(422, 'INVALID_SHARE_TARGET', 'Compartilhamento por tenant nao deve informar alvo.');
    }
    if (targetType === 'workspace' && targetWorkspaceId) {
      const workspace = await assistantsRepository.workspaceExists(targetWorkspaceId, user.tenant.id);
      if (!workspace) {
        throw new AppError(404, 'SHARE_TARGET_NOT_FOUND', 'Workspace de compartilhamento nao encontrado.');
      }
    }
    if (targetType === 'user' && targetUserId) {
      const targetUser = await assistantsRepository.userExists(targetUserId, user.tenant.id);
      if (!targetUser) {
        throw new AppError(404, 'SHARE_TARGET_NOT_FOUND', 'Usuario de compartilhamento nao encontrado.');
      }
    }
    if (targetType === 'role' && targetRoleId) {
      const role = await assistantsRepository.roleExists(targetRoleId, user.tenant.id);
      if (!role) {
        throw new AppError(404, 'SHARE_TARGET_NOT_FOUND', 'Role de compartilhamento nao encontrada.');
      }
    }

    const share = await assistantsRepository.createShare({
      ...input,
      targetType,
      targetUserId,
      targetWorkspaceId,
      targetRoleId,
      assistantId: assistant.id,
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      createdById: user.id,
    });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_share_created',
      entity: 'assistant_share',
      entityId: share.id,
      metadata: { assistantId: assistant.id, targetType: share.targetType, permission: share.permission },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantShare(share);
  },

  async deleteShare(id: string, shareId: string, user: AuthenticatedUser, context: RequestContext) {
    const assistant = await getAssistantOrThrow(id, user);
    await assertAllowed(
      assistantPolicies.canShareAssistant(user, subjectFromAssistant(assistant)),
      'canShareAssistant',
      user,
      assistant,
      context,
    );
    const deleted = await assistantsRepository.deleteShare(assistant.id, shareId);
    if (!deleted) {
      throw new AppError(404, 'ASSISTANT_SHARE_NOT_FOUND', 'Compartilhamento nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_share_removed',
      entity: 'assistant_share',
      entityId: shareId,
      metadata: { assistantId: assistant.id },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  },
};
