import { z } from 'zod';

const booleanQuery = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const chatVisibilityValues = ['private', 'workspace', 'team', 'shared'] as const;
export const chatMessageRoleValues = ['user', 'assistant', 'system'] as const;

export const assistantChatConversationsParamsSchema = z.object({
  id: z.string().uuid(),
});

export const chatConversationParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const chatConversationsQuerySchema = z.object({
  includeArchived: booleanQuery.default(false),
});

export const createChatConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const createChatMessageSchema = z.object({
  input: z.string().trim().min(1).max(2000),
}).strict();

export type ChatConversationsQuery = z.infer<typeof chatConversationsQuerySchema>;
export type CreateChatConversationInput = z.infer<typeof createChatConversationSchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
export type ChatVisibility = typeof chatVisibilityValues[number];
export type ChatMessageRole = typeof chatMessageRoleValues[number];
