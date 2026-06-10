import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { recordAuditEvent } from '../audit/audit.service';
import { mapAssistant } from './assistants.mapper';
import { assistantsRepository } from './assistants.repository';
import type { AssistantCreateInput, AssistantUpdateInput } from './assistants.schema';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

export const assistantsService = {
  async list(user: AuthenticatedUser) {
    const data = await assistantsRepository.list(user.tenant.id, userWorkspaceIds(user));
    return data.map(mapAssistant);
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
};
