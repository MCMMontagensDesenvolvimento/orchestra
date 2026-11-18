import { describe, expect, it } from 'vitest';
import { selectRecentHomeConversations } from './useRecentHomeConversations';
import type { ChatConversation } from '@/types';

const conversation = (overrides: Partial<ChatConversation> = {}): ChatConversation => ({
  id: 'c1',
  tenantId: 'tenant-1',
  workspaceId: 'w1',
  assistantId: 'a1',
  ownerUserId: 'u1',
  title: 'Minha conversa',
  visibility: 'private',
  archivedAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  messageCount: 2,
  lastMessageAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

describe('recent Home conversations', () => {
  it('keeps only own, non-archived conversations in allowed workspaces', () => {
    const items = selectRecentHomeConversations(
      [{ id: 'a1', name: 'Assistente autorizado' }],
      [[
        conversation(),
        conversation({ id: 'c2', ownerUserId: 'outro-usuario' }),
        conversation({ id: 'c3', workspaceId: 'outro-workspace' }),
        conversation({ id: 'c4', archivedAt: '2026-11-02T10:00:00.000Z' }),
        conversation({ id: 'c5', assistantId: 'outro-assistente' }),
      ]],
      'u1',
      ['w1'],
    );
    expect(items).toEqual([{
      id: 'c1', assistantId: 'a1', assistantName: 'Assistente autorizado',
      title: 'Minha conversa', updatedAt: '2026-11-01T10:00:00.000Z',
    }]);
  });

  it('sorts real histories across assistants and limits to three', () => {
    const items = selectRecentHomeConversations(
      [{ id: 'a1', name: 'Um' }, { id: 'a2', name: 'Dois' }],
      [
        [conversation({ id: 'c1', lastMessageAt: '2026-11-01T10:00:00Z' }),
         conversation({ id: 'c2', lastMessageAt: '2026-11-03T10:00:00Z' })],
        [conversation({ id: 'c3', assistantId: 'a2', lastMessageAt: '2026-11-02T10:00:00Z' }),
         conversation({ id: 'c4', assistantId: 'a2', lastMessageAt: '2026-11-04T10:00:00Z' })],
      ],
      'u1', ['w1'],
    );
    expect(items.map((item) => item.id)).toEqual(['c4', 'c2', 'c3']);
  });

  it('never renders conversation data without a confirmed user and workspace', () => {
    expect(selectRecentHomeConversations([{ id: 'a1', name: 'Um' }], [[conversation()]], undefined, ['w1'])).toEqual([]);
    expect(selectRecentHomeConversations([{ id: 'a1', name: 'Um' }], [[conversation()]], 'u1', [])).toEqual([]);
  });
});
