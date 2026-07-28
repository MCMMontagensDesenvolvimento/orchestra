import type { AssistantKnowledgeBinding } from '@/types';
import type { AssistantKnowledgeBindingPayload } from '@/services/knowledge.service';

interface KnowledgeBindingPort {
  createAssistantBinding(
    assistantId: string,
    payload: AssistantKnowledgeBindingPayload,
  ): Promise<AssistantKnowledgeBinding>;
  removeAssistantBinding(assistantId: string, bindingId: string): Promise<void>;
}

export interface SynchronizeKnowledgeBindingsInput {
  assistantId: string;
  selectedKnowledgeBaseIds: string[];
  currentBindings: AssistantKnowledgeBinding[];
  knowledgeService: KnowledgeBindingPort;
}

export async function synchronizeKnowledgeBindings({
  assistantId,
  selectedKnowledgeBaseIds,
  currentBindings,
  knowledgeService,
}: SynchronizeKnowledgeBindingsInput): Promise<void> {
  const selectedIds = new Set(selectedKnowledgeBaseIds);
  const currentByKnowledgeBaseId = new Map(
    currentBindings.map(binding => [binding.knowledgeBaseId, binding]),
  );

  const toEnable = [...selectedIds]
    .filter(knowledgeBaseId => !currentByKnowledgeBaseId.get(knowledgeBaseId)?.isEnabled)
    .sort();
  const toDisable = currentBindings
    .filter(binding => binding.isEnabled && !selectedIds.has(binding.knowledgeBaseId))
    .sort((left, right) => left.knowledgeBaseId.localeCompare(right.knowledgeBaseId));

  for (const knowledgeBaseId of toEnable) {
    await knowledgeService.createAssistantBinding(assistantId, {
      knowledgeBaseId,
      isEnabled: true,
      retrievalMode: 'retrieval_placeholder',
      priority: 100,
    });
  }

  for (const binding of toDisable) {
    await knowledgeService.removeAssistantBinding(assistantId, binding.id);
  }
}
