import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endpoints } from '@/services/api/endpoints';
import type { AssistantWizardFormData } from '@/types';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiPatch = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    appEnv: 'test',
    isProductionLike: false,
    useMocks: false,
    mockModeAllowed: true,
    mockModeBlockedReason: null,
    mockDelayMs: 0,
    mockScenario: 'success',
    apiBaseUrl: '/api/v1',
  },
}));

vi.mock('@/services/api/api-client', () => ({
  apiClient: {
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    delete: apiDelete,
  },
}));

import {
  AssistantWizardSaveError,
  assistantsService,
  buildAssistantPayload,
} from '@/services/assistants.service';

const formData: AssistantWizardFormData = {
  name: 'Assistente Jurídico',
  area: 'Jurídico',
  description: 'Consulta políticas jurídicas internas.',
  objective: 'Orientar sobre políticas internas.',
  tasks: 'Consultar políticas.',
  prohibitedTasks: 'Não emitir parecer jurídico.',
  persona: 'Especialista cuidadoso.',
  tone: 'Técnico',
  humor: 'nenhum',
  formality: 'muito_formal',
  rules: 'Citar fontes.',
  restrictions: 'Não inventar jurisprudência.',
  criticalInstructions: 'Escalonar casos externos.',
  modelProvider: 'anthropic',
  model: 'claude-3.5-sonnet',
  fallbackModel: 'gpt-4o-mini',
  temperature: '0.2',
  responseFormat: 'Tópicos curtos.',
  positiveExamples: 'Resposta com fonte.',
  negativeExamples: 'Resposta sem fonte.',
  limits: 'Somente políticas internas.',
  escalationPolicy: 'Encaminhar ao Jurídico.',
  knowledgeBases: ['kb-2', 'kb-1'],
  mcpTools: [],
  approvalActions: 'Ações externas.',
  environment: 'staging',
  legacyInstructions: '',
};

const apiAssistant = (status: 'draft' | 'published' = 'draft') => ({
  id: 'assistant-1',
  tenantId: 'tenant-1',
  workspaceId: 'workspace-1',
  name: formData.name,
  description: formData.description,
  status,
  createdById: 'user-1',
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  versions: [{
    id: 'version-1',
    assistantId: 'assistant-1',
    version: '0.1.0',
    status,
    displayName: formData.name,
    description: null,
    instructions: 'prompt',
    modelProvider: 'anthropic',
    modelName: formData.model,
    temperature: 0.2,
    configuration: buildAssistantPayload(formData).version.configuration,
    createdById: 'user-1',
    createdAt: '2026-07-28T10:00:00.000Z',
    publishedAt: status === 'published' ? '2026-07-28T10:01:00.000Z' : null,
    archivedAt: null,
  }],
});

describe('assistant Wizard save workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends configuration, creates bindings, and publishes only after every binding succeeds', async () => {
    const callOrder: string[] = [];
    apiPost.mockImplementation(async (url: string) => {
      callOrder.push(url);
      if (url === endpoints.assistants.list) {
        return { data: { data: apiAssistant() } };
      }
      if (url === endpoints.assistants.publish('assistant-1')) {
        return { data: { data: apiAssistant('published') } };
      }
      if (url === endpoints.assistants.knowledgeBindings('assistant-1')) {
        return {
          data: {
            data: {
              id: `binding-${callOrder.length}`,
              tenantId: 'tenant-1',
              workspaceId: 'workspace-1',
              assistantId: 'assistant-1',
              knowledgeBaseId: 'kb',
              isEnabled: true,
              retrievalMode: 'retrieval_placeholder',
              priority: 100,
              createdById: 'user-1',
              createdAt: '2026-07-28T10:00:00.000Z',
              updatedAt: '2026-07-28T10:00:00.000Z',
            },
          },
        };
      }
      throw new Error(`unexpected test URL: ${url}`);
    });

    await expect(assistantsService.create(formData, true, true)).resolves.toMatchObject({
      id: 'assistant-1',
      status: 'published',
      area: 'Jurídico',
    });

    const createPayload = apiPost.mock.calls[0][1];
    expect(createPayload.description).toBe(formData.description);
    expect(createPayload.version.displayName).toBe(formData.name);
    expect(createPayload.version.modelProvider).toBe('anthropic');
    expect(createPayload.version.configuration).toMatchObject({
      schemaVersion: 1,
      identity: { area: 'Jurídico', environment: 'staging' },
      objective: { main: formData.objective },
    });
    expect(createPayload.version.instructions).toContain('## Objetivo');

    expect(callOrder).toEqual([
      endpoints.assistants.list,
      endpoints.assistants.knowledgeBindings('assistant-1'),
      endpoints.assistants.knowledgeBindings('assistant-1'),
      endpoints.assistants.publish('assistant-1'),
    ]);
  });

  it('keeps the assistant as draft and does not publish after a binding failure', async () => {
    apiPost.mockImplementation(async (url: string) => {
      if (url === endpoints.assistants.list) {
        return { data: { data: apiAssistant() } };
      }
      if (url === endpoints.assistants.knowledgeBindings('assistant-1')) {
        throw new Error('raw backend detail that must not reach the UI');
      }
      if (url === endpoints.assistants.publish('assistant-1')) {
        return { data: { data: apiAssistant('published') } };
      }
      throw new Error(`unexpected test URL: ${url}`);
    });

    const error = await assistantsService.create(formData, true, true).catch(value => value);

    expect(error).toBeInstanceOf(AssistantWizardSaveError);
    expect(error).toMatchObject({ phase: 'knowledge-bindings', assistantId: 'assistant-1' });
    expect(error.message).not.toContain('raw backend detail');
    expect(apiPost).not.toHaveBeenCalledWith(endpoints.assistants.publish('assistant-1'));
  });

  it('updates metadata and creates a structured version without using objective as description', async () => {
    apiPatch.mockResolvedValue({ data: { data: apiAssistant() } });
    apiPost.mockResolvedValue({ data: { data: apiAssistant().versions[0] } });

    await assistantsService.update('assistant-1', formData, false, false);

    expect(apiPatch).toHaveBeenCalledWith(endpoints.assistants.detail('assistant-1'), {
      name: formData.name,
      description: formData.description,
      status: 'draft',
    });
    expect(apiPost).toHaveBeenCalledWith(
      endpoints.assistants.versions('assistant-1'),
      expect.objectContaining({
        displayName: formData.name,
        configuration: expect.objectContaining({ schemaVersion: 1 }),
      }),
    );
  });
});
