import type { Assistant, AssistantVersion, AssistantFeedback, AssistantTestResult } from '@/types';
import {
  mockAssistants, mockAssistantVersions, mockAssistantFeedbacks, mockTestResults,
} from '@/services/mocks';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';
// import { apiClient } from './api/api-client';
// import { endpoints } from './api/endpoints';

export const assistantsService = {
  list(): Promise<Assistant[]> {
    if (env.useMocks) return mockResponse(mockAssistants);
    // return apiClient.get<Assistant[]>(endpoints.assistants.list).then(r => r.data);
    throw new Error('API real ainda não implementada — mantenha VITE_USE_MOCKS=true.');
  },
  get(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    throw new Error('API real ainda não implementada.');
  },
  versions(assistantId: string): Promise<AssistantVersion[]> {
    if (env.useMocks) return mockResponse(mockAssistantVersions.filter(v => v.assistantId === assistantId));
    throw new Error('API real ainda não implementada.');
  },
  feedback(assistantId: string): Promise<AssistantFeedback[]> {
    if (env.useMocks) return mockResponse(mockAssistantFeedbacks.filter(f => f.assistantId === assistantId));
    throw new Error('API real ainda não implementada.');
  },
  testResults(assistantId: string): Promise<AssistantTestResult[]> {
    if (env.useMocks) return mockResponse(mockTestResults.filter(t => t.assistantId === assistantId));
    throw new Error('API real ainda não implementada.');
  },
};
