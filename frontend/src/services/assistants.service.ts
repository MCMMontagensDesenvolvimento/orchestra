import type {
  Assistant,
  AssistantFeedback,
  AssistantPublication,
  AssistantTestResult,
  AssistantVersion,
  AssistantWizardFormData,
} from '@/types';
import {
  mockAssistants, mockAssistantVersions, mockAssistantFeedbacks, mockTestResults,
} from '@/services/mocks';
import { mockResponse, mockFind } from '@/services/mocks/mock-utils';
import { env } from '@/lib/env';
import { apiClient, type ApiEnvelope, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

interface ApiAssistantVersion {
  id: string;
  assistantId: string;
  version: string;
  status: Assistant['status'];
  displayName: string;
  description: string | null;
  instructions: string | null;
  modelProvider: string | null;
  modelName: string | null;
  temperature: number | null;
  configuration?: unknown;
  createdById: string;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
}

interface ApiAssistantPublication {
  id: string;
  assistantId: string;
  assistantVersionId: string;
  status: 'active' | 'inactive';
  publishedById: string;
  publishedAt: string;
  unpublishedById: string | null;
  unpublishedAt: string | null;
  rollbackFromPublicationId: string | null;
  rollbackReason: string | null;
}

interface ApiAssistant {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: Assistant['status'];
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; email: string };
  versions?: ApiAssistantVersion[];
  activePublication?: ApiAssistantPublication | null;
  publications?: ApiAssistantPublication[];
}

interface ApiAssistantFeedback {
  id: string;
  assistantId: string;
  assistantVersionId: string | null;
  conversationId: string | null;
  messageId: string | null;
  userId: string;
  rating: 'positive' | 'negative' | 'neutral';
  comment: string | null;
  createdAt: string;
}

interface ApiAssistantTestResult {
  id: string;
  assistantId: string;
  assistantVersionId: string;
  testedById: string;
  input: string;
  expectedBehavior: string | null;
  actualOutput: string;
  status: 'passed' | 'failed' | 'needs_review';
  score: number | null;
  notes: string | null;
  createdAt: string;
}

const mapAssistant = (assistant: ApiAssistant): Assistant => {
  const latestVersion = assistant.versions?.[0];
  const modelName = latestVersion?.modelName ?? 'not-configured';
  const instructions = latestVersion?.instructions ?? '';

  return {
    id: assistant.id,
    name: assistant.name,
    description: assistant.description ?? '',
    area: assistant.workspaceId,
    owner: assistant.createdBy?.name ?? assistant.createdById,
    status: assistant.status,
    model: modelName,
    fallbackModel: modelName,
    temperature: latestVersion?.temperature ?? 0.2,
    version: latestVersion?.version ?? '0.1.0',
    conversations: 0,
    costThisMonth: 0,
    satisfaction: 0,
    createdAt: assistant.createdAt,
    updatedAt: assistant.updatedAt,
    knowledgeBases: [],
    mcpTools: [],
    objective: assistant.description ?? '',
    persona: latestVersion?.displayName,
    instructions,
    tasks: instructions,
    environment: assistant.status === 'published' ? 'production' : 'staging',
    activePublication: assistant.activePublication ?? null,
  } as Assistant;
};

const mapVersion = (version: ApiAssistantVersion): AssistantVersion => ({
  id: version.id,
  assistantId: version.assistantId,
  version: version.version,
  changelog: version.displayName,
  author: version.createdById,
  createdAt: version.createdAt,
  status: version.status,
  description: version.description,
  instructions: version.instructions,
  publishedAt: version.publishedAt,
  archivedAt: version.archivedAt,
});

const mapPublication = (publication: ApiAssistantPublication): AssistantPublication => ({
  id: publication.id,
  assistantId: publication.assistantId,
  assistantVersionId: publication.assistantVersionId,
  status: publication.status,
  publishedById: publication.publishedById,
  publishedAt: publication.publishedAt,
  unpublishedById: publication.unpublishedById,
  unpublishedAt: publication.unpublishedAt,
  rollbackFromPublicationId: publication.rollbackFromPublicationId,
  rollbackReason: publication.rollbackReason,
});

const mapFeedback = (feedback: ApiAssistantFeedback): AssistantFeedback => ({
  id: feedback.id,
  assistantId: feedback.assistantId,
  assistantVersionId: feedback.assistantVersionId,
  conversationId: feedback.conversationId,
  messageId: feedback.messageId,
  type: feedback.rating,
  rating: feedback.rating,
  comment: feedback.comment ?? undefined,
  user: feedback.userId,
  timestamp: feedback.createdAt,
});

const mapTestResult = (test: ApiAssistantTestResult): AssistantTestResult => ({
  id: test.id,
  assistantId: test.assistantId,
  assistantVersionId: test.assistantVersionId,
  prompt: test.input,
  response: test.actualOutput,
  model: 'manual/simulado',
  latency: 0,
  tokensUsed: 0,
  sourcesUsed: [],
  toolsUsed: [],
  timestamp: test.createdAt,
  passed: test.status === 'passed',
  input: test.input,
  expectedBehavior: test.expectedBehavior,
  actualOutput: test.actualOutput,
  status: test.status,
  score: test.score,
  notes: test.notes,
});

const buildAssistantPayload = (formData: AssistantWizardFormData) => ({
  name: formData.name,
  description: formData.description || formData.objective,
  status: 'draft',
  version: {
    displayName: formData.persona || 'Initial draft',
    instructions: [
      formData.objective,
      formData.tasks,
      formData.rules,
      formData.restrictions,
      formData.criticalInstructions,
      formData.responseFormat,
      formData.limits,
      formData.escalationPolicy,
    ].filter(Boolean).join('\n\n'),
    modelProvider: formData.model.includes('claude') ? 'anthropic' : 'openai',
    modelName: formData.model,
    temperature: Number(formData.temperature || 0.2),
  },
});

export const assistantsService = {
  async list(): Promise<Assistant[]> {
    if (env.useMocks) return mockResponse(mockAssistants);
    const response = await apiClient.get<PaginatedApiEnvelope<ApiAssistant>>(endpoints.assistants.list);
    return response.data.data.map(mapAssistant);
  },

  async get(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.get<ApiEnvelope<ApiAssistant>>(endpoints.assistants.detail(id));
    return mapAssistant(response.data.data);
  },

  async create(formData: AssistantWizardFormData, publish = false): Promise<Assistant> {
    if (env.useMocks) {
      return mockResponse({
        ...mockAssistants[0],
        id: `mock-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        status: publish ? 'published' : 'draft',
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.list, buildAssistantPayload(formData));
    if (!publish) return mapAssistant(response.data.data);
    return assistantsService.publish(response.data.data.id);
  },

  async update(id: string, formData: AssistantWizardFormData, publish = false): Promise<Assistant> {
    if (env.useMocks) {
      const assistant = mockAssistants.find((item) => item.id === id) ?? mockAssistants[0];
      return mockResponse({
        ...assistant,
        name: formData.name,
        description: formData.description,
        status: publish ? 'published' : assistant.status,
      });
    }
    const response = await apiClient.patch<ApiEnvelope<ApiAssistant>>(endpoints.assistants.detail(id), {
      name: formData.name,
      description: formData.description || formData.objective,
      status: 'draft',
    });
    await apiClient.post<ApiEnvelope<ApiAssistantVersion>>(endpoints.assistants.versions(id), {
      ...buildAssistantPayload(formData).version,
      displayName: formData.persona || `Draft ${new Date().toISOString()}`,
    });
    if (!publish) return mapAssistant(response.data.data);
    return assistantsService.publish(id);
  },

  async archive(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.archive(id));
    return mapAssistant(response.data.data);
  },

  async restore(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.restore(id));
    return mapAssistant(response.data.data);
  },

  async publish(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.publish(id));
    return mapAssistant(response.data.data);
  },

  async unpublish(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.unpublish(id));
    return mapAssistant(response.data.data);
  },

  async rollback(id: string, payload: { versionId?: string; publicationId?: string; reason: string }): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.rollback(id), payload);
    return mapAssistant(response.data.data);
  },

  async versions(assistantId: string): Promise<AssistantVersion[]> {
    if (env.useMocks) return mockResponse(mockAssistantVersions.filter((version) => version.assistantId === assistantId));
    const response = await apiClient.get<ApiEnvelope<ApiAssistantVersion[]>>(endpoints.assistants.versions(assistantId));
    return response.data.data.map(mapVersion);
  },

  async publications(assistantId: string): Promise<AssistantPublication[]> {
    if (env.useMocks) return mockResponse([]);
    const response = await apiClient.get<ApiEnvelope<ApiAssistantPublication[]>>(endpoints.assistants.publications(assistantId));
    return response.data.data.map(mapPublication);
  },

  async activePublication(assistantId: string): Promise<AssistantPublication | null> {
    if (env.useMocks) return mockResponse(null);
    const response = await apiClient.get<ApiEnvelope<ApiAssistantPublication | null>>(endpoints.assistants.activePublication(assistantId));
    return response.data.data ? mapPublication(response.data.data) : null;
  },

  async feedback(assistantId: string): Promise<AssistantFeedback[]> {
    if (env.useMocks) return mockResponse(mockAssistantFeedbacks.filter((feedback) => feedback.assistantId === assistantId));
    const response = await apiClient.get<ApiEnvelope<ApiAssistantFeedback[]>>(endpoints.assistants.feedback(assistantId));
    return response.data.data.map(mapFeedback);
  },

  async createFeedback(assistantId: string, payload: { rating: 'positive' | 'negative' | 'neutral'; comment?: string; assistantVersionId?: string }): Promise<AssistantFeedback> {
    if (env.useMocks) {
      return mockResponse({
        id: `feedback-${Date.now()}`,
        assistantId,
        conversationId: '',
        type: payload.rating,
        rating: payload.rating,
        comment: payload.comment,
        user: 'Mock User',
        timestamp: new Date().toISOString(),
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiAssistantFeedback>>(endpoints.assistants.feedback(assistantId), payload);
    return mapFeedback(response.data.data);
  },

  async testResults(assistantId: string): Promise<AssistantTestResult[]> {
    if (env.useMocks) return mockResponse(mockTestResults.filter((test) => test.assistantId === assistantId));
    const response = await apiClient.get<ApiEnvelope<ApiAssistantTestResult[]>>(endpoints.assistants.testResults(assistantId));
    return response.data.data.map(mapTestResult);
  },

  async createTestResult(assistantId: string, payload: {
    assistantVersionId?: string;
    input: string;
    expectedBehavior?: string;
    actualOutput: string;
    status: 'passed' | 'failed' | 'needs_review';
    score?: number;
    notes?: string;
  }): Promise<AssistantTestResult> {
    if (env.useMocks) {
      return mockResponse({
        id: `test-${Date.now()}`,
        assistantId,
        assistantVersionId: payload.assistantVersionId,
        prompt: payload.input,
        response: payload.actualOutput,
        model: 'manual/simulado',
        latency: 0,
        tokensUsed: 0,
        sourcesUsed: [],
        toolsUsed: [],
        timestamp: new Date().toISOString(),
        passed: payload.status === 'passed',
        input: payload.input,
        expectedBehavior: payload.expectedBehavior,
        actualOutput: payload.actualOutput,
        status: payload.status,
        score: payload.score,
        notes: payload.notes,
      });
    }
    const response = await apiClient.post<ApiEnvelope<ApiAssistantTestResult>>(endpoints.assistants.testResults(assistantId), payload);
    return mapTestResult(response.data.data);
  },
};
