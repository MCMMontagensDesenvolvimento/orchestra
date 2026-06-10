import type {
  Assistant,
  AssistantFeedback,
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
  instructions: string | null;
  modelProvider: string | null;
  modelName: string | null;
  temperature: number | null;
  createdById: string;
  createdAt: string;
  publishedAt: string | null;
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
    if (!publish) return mapAssistant(response.data.data);
    return assistantsService.publish(id);
  },

  async archive(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.archive(id));
    return mapAssistant(response.data.data);
  },

  async publish(id: string): Promise<Assistant> {
    if (env.useMocks) return mockFind(mockAssistants, id);
    const response = await apiClient.post<ApiEnvelope<ApiAssistant>>(endpoints.assistants.publish(id));
    return mapAssistant(response.data.data);
  },

  async versions(assistantId: string): Promise<AssistantVersion[]> {
    if (env.useMocks) return mockResponse(mockAssistantVersions.filter((version) => version.assistantId === assistantId));
    const response = await apiClient.get<ApiEnvelope<ApiAssistantVersion[]>>(endpoints.assistants.versions(assistantId));
    return response.data.data.map(mapVersion);
  },

  async feedback(assistantId: string): Promise<AssistantFeedback[]> {
    if (env.useMocks) return mockResponse(mockAssistantFeedbacks.filter((feedback) => feedback.assistantId === assistantId));
    return [];
  },

  async testResults(assistantId: string): Promise<AssistantTestResult[]> {
    if (env.useMocks) return mockResponse(mockTestResults.filter((test) => test.assistantId === assistantId));
    return [];
  },
};
