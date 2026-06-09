import type { KnowledgeBase, KnowledgeDocument } from '@/types';
import { mockKnowledgeBases, mockDocuments } from '@/services/mocks';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';

export const knowledgeService = {
  list(): Promise<KnowledgeBase[]> {
    if (env.useMocks) return mockResponse(mockKnowledgeBases);
    throw new Error('API real ainda não implementada.');
  },
  get(id: string): Promise<KnowledgeBase> {
    if (env.useMocks) return mockFind(mockKnowledgeBases, id);
    throw new Error('API real ainda não implementada.');
  },
  documents(knowledgeBaseId?: string): Promise<KnowledgeDocument[]> {
    if (env.useMocks) {
      const docs = knowledgeBaseId
        ? mockDocuments.filter(d => d.knowledgeBaseId === knowledgeBaseId)
        : mockDocuments;
      return mockResponse(docs);
    }
    throw new Error('API real ainda não implementada.');
  },
};
