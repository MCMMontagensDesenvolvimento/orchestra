import { Router } from 'express';
import { requireAuth, requirePermission } from '../../shared/middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate';
import { chatConversationsController } from './chat-conversations.controller';
import {
  assistantChatConversationsParamsSchema,
  chatConversationParamsSchema,
  chatConversationsQuerySchema,
  createChatConversationSchema,
  createChatMessageSchema,
} from './chat-conversations.schema';

export function registerAssistantChatConversationRoutes(router: Router) {
  router.get(
    '/:id/conversations',
    requireAuth,
    requirePermission('assistants.read'),
    validateParams(assistantChatConversationsParamsSchema),
    validateQuery(chatConversationsQuerySchema),
    (req, res, next) => {
      void chatConversationsController.listForAssistant(req, res).catch(next);
    },
  );

  router.post(
    '/:id/conversations',
    requireAuth,
    requirePermission('assistants.read'),
    validateParams(assistantChatConversationsParamsSchema),
    validateBody(createChatConversationSchema),
    (req, res, next) => {
      void chatConversationsController.createForAssistant(req, res).catch(next);
    },
  );
}

export function createChatConversationsRouter() {
  const router = Router();

  router.get(
    '/conversations/:conversationId',
    requireAuth,
    requirePermission('assistants.read'),
    validateParams(chatConversationParamsSchema),
    (req, res, next) => {
      void chatConversationsController.get(req, res).catch(next);
    },
  );

  router.post(
    '/conversations/:conversationId/messages',
    requireAuth,
    requirePermission('agent_runs.create'),
    validateParams(chatConversationParamsSchema),
    validateBody(createChatMessageSchema),
    (req, res, next) => {
      void chatConversationsController.sendMessage(req, res).catch(next);
    },
  );

  router.post(
    '/conversations/:conversationId/archive',
    requireAuth,
    requirePermission('assistants.read'),
    validateParams(chatConversationParamsSchema),
    (req, res, next) => {
      void chatConversationsController.archive(req, res).catch(next);
    },
  );

  return router;
}
