import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const assistantStatusValues = ['draft', 'testing', 'pending_approval', 'published', 'archived'] as const;
export const assistantVersionStatusValues = assistantStatusValues;
export const assistantFeedbackRatingValues = ['positive', 'negative', 'neutral'] as const;
export const assistantTestResultStatusValues = ['passed', 'failed', 'needs_review'] as const;
export const assistantShareTargetValues = ['workspace', 'user', 'role', 'tenant'] as const;
export const assistantSharePermissionValues = ['can_use', 'can_edit', 'can_manage', 'can_share'] as const;

export const assistantsQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'status', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(assistantStatusValues).optional(),
  workspaceId: z.string().uuid().optional(),
});

export const assistantCreateSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(assistantStatusValues).default('draft'),
  version: z
    .object({
      displayName: z.string().trim().min(2).max(120).default('Initial draft'),
      description: z.string().trim().max(1000).optional(),
      instructions: z.string().trim().max(10000).optional(),
      modelProvider: z.string().trim().max(80).optional(),
      modelName: z.string().trim().max(120).optional(),
      temperature: z.number().min(0).max(2).optional(),
      configuration: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export const assistantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(assistantStatusValues).optional(),
});

export const assistantVersionCreateSchema = z.object({
  version: z.string().trim().min(1).max(40).optional(),
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  instructions: z.string().trim().max(10000).optional(),
  modelProvider: z.string().trim().max(80).optional(),
  modelName: z.string().trim().max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  configuration: z.record(z.unknown()).optional(),
});

export const assistantVersionParamsSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const assistantPublishSchema = z.object({
  versionId: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
}).default({});

export const assistantRollbackSchema = z.object({
  publicationId: z.string().uuid().optional(),
  versionId: z.string().uuid().optional(),
  reason: z.string().trim().min(2).max(500).optional(),
}).refine((input) => input.publicationId || input.versionId || input.reason, {
  path: ['reason'],
  message: 'Informe publicationId, versionId ou reason para registrar o rollback.',
});

export const assistantShareCreateSchema = z.object({
  shareType: z.enum(assistantShareTargetValues).optional(),
  targetType: z.enum(assistantShareTargetValues).optional(),
  targetId: z.string().uuid().nullable().optional(),
  targetUserId: z.string().uuid().nullable().optional(),
  targetWorkspaceId: z.string().uuid().nullable().optional(),
  targetRoleId: z.string().uuid().nullable().optional(),
  permission: z.enum(assistantSharePermissionValues).default('can_use'),
}).refine((input) => {
  const targetType = input.targetType ?? input.shareType;
  if (targetType === 'tenant') return true;
  if (targetType === 'user') return Boolean(input.targetUserId ?? input.targetId);
  if (targetType === 'workspace') return Boolean(input.targetWorkspaceId ?? input.targetId);
  if (targetType === 'role') return Boolean(input.targetRoleId ?? input.targetId);
  return false;
}, {
  path: ['targetId'],
  message: 'Compartilhamento por user, workspace ou role exige alvo.',
});

export const assistantShareParamsSchema = z.object({
  id: z.string().uuid(),
  shareId: z.string().uuid(),
});

export const assistantFeedbackCreateSchema = z.object({
  assistantVersionId: z.string().uuid().optional(),
  conversationId: z.string().trim().max(120).optional(),
  messageId: z.string().trim().max(120).optional(),
  rating: z.enum(assistantFeedbackRatingValues),
  comment: z.string().trim().max(2000).optional(),
});

export const assistantTestResultCreateSchema = z.object({
  assistantVersionId: z.string().uuid().optional(),
  input: z.string().trim().min(1).max(10000),
  expectedBehavior: z.string().trim().max(10000).optional(),
  actualOutput: z.string().trim().min(1).max(10000),
  status: z.enum(assistantTestResultStatusValues),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export type AssistantsQuery = z.infer<typeof assistantsQuerySchema>;
export type AssistantCreateInput = z.infer<typeof assistantCreateSchema>;
export type AssistantUpdateInput = z.infer<typeof assistantUpdateSchema>;
export type AssistantVersionCreateInput = z.infer<typeof assistantVersionCreateSchema>;
export type AssistantPublishInput = z.infer<typeof assistantPublishSchema>;
export type AssistantRollbackInput = z.infer<typeof assistantRollbackSchema>;
export type AssistantShareCreateInput = z.infer<typeof assistantShareCreateSchema>;
export type AssistantFeedbackCreateInput = z.infer<typeof assistantFeedbackCreateSchema>;
export type AssistantTestResultCreateInput = z.infer<typeof assistantTestResultCreateSchema>;
