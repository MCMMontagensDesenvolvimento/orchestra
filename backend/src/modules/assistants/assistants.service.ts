import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { recordAuditEvent } from '../audit/audit.service';
import { mapAssistant, mapAssistantShare, mapAssistantVersion } from './assistants.mapper';
import { assistantsRepository } from './assistants.repository';
import type {
  AssistantCreateInput,
  AssistantsQuery,
  AssistantShareCreateInput,
  AssistantUpdateInput,
  AssistantVersionCreateInput,
} from './assistants.schema';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

export const assistantsService = {
  async list(user: AuthenticatedUser, query: AssistantsQuery) {
    const result = await assistantsRepository.list(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAssistant),
      pagination: paginationMeta(query, result.total),
    };
  },

  async get(id: string, user: AuthenticatedUser) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    return mapAssistant(assistant);
  },

  async create(
    input: AssistantCreateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const workspaceId = input.workspaceId ?? user.workspaces[0]?.id;
    if (!workspaceId || !userWorkspaceIds(user).includes(workspaceId)) {
      throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
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
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return mapAssistant(assistant);
  },

  async update(
    id: string,
    input: AssistantUpdateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
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
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return mapAssistant(assistant);
  },

  async archive(
    id: string,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const assistant = await assistantsRepository.archive(id, user.tenant.id, userWorkspaceIds(user));
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

  async listVersions(id: string, user: AuthenticatedUser) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    const versions = await assistantsRepository.listVersions(assistant.id);
    return versions.map(mapAssistantVersion);
  },

  async createVersion(
    id: string,
    input: AssistantVersionCreateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
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
      metadata: { assistantId: assistant.id },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantVersion(version);
  },

  async getVersion(id: string, versionId: string, user: AuthenticatedUser) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    const version = await assistantsRepository.findVersion(assistant.id, versionId);
    if (!version) {
      throw new AppError(404, 'ASSISTANT_VERSION_NOT_FOUND', 'Versao do assistente nao encontrada.');
    }
    return mapAssistantVersion(version);
  },

  async publish(
    id: string,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const assistant = await assistantsRepository.publish(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente ou versao nao encontrada.');
    }
    const publishedVersion = assistant.versions.find((version) => version.status === 'published');
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_published',
      entity: 'assistant',
      entityId: assistant.id,
      metadata: publishedVersion ? { versionId: publishedVersion.id } : undefined,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistant(assistant);
  },

  async unpublish(
    id: string,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const assistant = await assistantsRepository.unpublish(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_unpublished',
      entity: 'assistant',
      entityId: assistant.id,
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistant(assistant);
  },

  async listShares(id: string, user: AuthenticatedUser) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    const shares = await assistantsRepository.listShares(assistant.id);
    return shares.map(mapAssistantShare);
  },

  async createShare(
    id: string,
    input: AssistantShareCreateInput,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    if (input.shareType === 'tenant' && input.targetId) {
      throw new AppError(422, 'INVALID_SHARE_TARGET', 'Compartilhamento por tenant nao deve informar targetId.');
    }
    if (input.shareType !== 'tenant' && !input.targetId) {
      throw new AppError(422, 'INVALID_SHARE_TARGET', 'Compartilhamento por workspace ou usuario exige targetId.');
    }
    if (input.shareType === 'workspace' && input.targetId) {
      const workspace = await assistantsRepository.workspaceExists(input.targetId, user.tenant.id);
      if (!workspace) {
        throw new AppError(404, 'SHARE_TARGET_NOT_FOUND', 'Workspace de compartilhamento nao encontrado.');
      }
    }
    if (input.shareType === 'user' && input.targetId) {
      const targetUser = await assistantsRepository.userExists(input.targetId, user.tenant.id);
      if (!targetUser) {
        throw new AppError(404, 'SHARE_TARGET_NOT_FOUND', 'Usuario de compartilhamento nao encontrado.');
      }
    }
    const share = await assistantsRepository.createShare({ ...input, assistantId: assistant.id });
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_share_created',
      entity: 'assistant_share',
      entityId: share.id,
      metadata: { assistantId: assistant.id, shareType: share.shareType },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return mapAssistantShare(share);
  },

  async deleteShare(
    id: string,
    shareId: string,
    user: AuthenticatedUser,
    context: { requestId: string; ipAddress?: string; userAgent?: string },
  ) {
    const assistant = await assistantsRepository.findById(id, user.tenant.id, userWorkspaceIds(user));
    if (!assistant) {
      throw new AppError(404, 'ASSISTANT_NOT_FOUND', 'Assistente nao encontrado.');
    }
    const deleted = await assistantsRepository.deleteShare(assistant.id, shareId);
    if (!deleted) {
      throw new AppError(404, 'ASSISTANT_SHARE_NOT_FOUND', 'Compartilhamento nao encontrado.');
    }
    await recordAuditEvent({
      tenantId: user.tenant.id,
      workspaceId: assistant.workspaceId,
      actorUserId: user.id,
      action: 'assistant_share_deleted',
      entity: 'assistant_share',
      entityId: shareId,
      metadata: { assistantId: assistant.id },
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  },
};
