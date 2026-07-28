import { describe, expect, it, vi } from 'vitest';
import type { AssistantKnowledgeBinding } from '@/types';
import { synchronizeKnowledgeBindings } from './assistantWizard.knowledge';

const binding = (
  knowledgeBaseId: string,
  isEnabled: boolean,
): AssistantKnowledgeBinding => ({
  id: `binding-${knowledgeBaseId}`,
  assistantId: 'assistant-1',
  knowledgeBaseId,
  isEnabled,
  retrievalMode: isEnabled ? 'retrieval_placeholder' : 'disabled',
  priority: 100,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
});

describe('assistant Wizard Knowledge Binding synchronization', () => {
  it('creates new bindings, reactivates disabled bindings, and disables removed bindings', async () => {
    const createAssistantBinding = vi.fn(async (_assistantId, payload) =>
      binding(payload.knowledgeBaseId, true));
    const removeAssistantBinding = vi.fn(async () => undefined);

    await synchronizeKnowledgeBindings({
      assistantId: 'assistant-1',
      selectedKnowledgeBaseIds: ['kb-keep', 'kb-reactivate', 'kb-new', 'kb-new'],
      currentBindings: [
        binding('kb-keep', true),
        binding('kb-remove', true),
        binding('kb-reactivate', false),
      ],
      knowledgeService: {
        createAssistantBinding,
        removeAssistantBinding,
      },
    });

    expect(createAssistantBinding).toHaveBeenCalledTimes(2);
    expect(createAssistantBinding).toHaveBeenNthCalledWith(1, 'assistant-1', {
      knowledgeBaseId: 'kb-new',
      isEnabled: true,
      retrievalMode: 'retrieval_placeholder',
      priority: 100,
    });
    expect(createAssistantBinding).toHaveBeenNthCalledWith(2, 'assistant-1', {
      knowledgeBaseId: 'kb-reactivate',
      isEnabled: true,
      retrievalMode: 'retrieval_placeholder',
      priority: 100,
    });
    expect(removeAssistantBinding).toHaveBeenCalledWith(
      'assistant-1',
      'binding-kb-remove',
    );
  });

  it('does not call the binding API when the diff is empty', async () => {
    const createAssistantBinding = vi.fn();
    const removeAssistantBinding = vi.fn();

    await synchronizeKnowledgeBindings({
      assistantId: 'assistant-1',
      selectedKnowledgeBaseIds: ['kb-keep'],
      currentBindings: [binding('kb-keep', true)],
      knowledgeService: {
        createAssistantBinding,
        removeAssistantBinding,
      },
    });

    expect(createAssistantBinding).not.toHaveBeenCalled();
    expect(removeAssistantBinding).not.toHaveBeenCalled();
  });
});
