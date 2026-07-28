import { describe, expect, it } from 'vitest';
import type {
  Assistant,
  AssistantKnowledgeBinding,
  AssistantWizardFormData,
} from '@/types';
import {
  compileAssistantInstructions,
  hydrateLegacyWizardForm,
  hydrateWizardForm,
  parseWizardConfiguration,
  serializeWizardForm,
} from './assistantWizard.serialization';

const formData: AssistantWizardFormData = {
  name: 'Assistente Financeiro',
  area: 'Financeiro',
  description: 'Apoia o fechamento mensal.',
  objective: 'Apoiar o time financeiro.',
  tasks: 'Consultar políticas.\nExplicar processos.',
  prohibitedTasks: 'Não aprovar pagamentos.',
  persona: 'Analista financeiro experiente.',
  tone: 'Direto e acolhedor.',
  humor: 'neutro',
  formality: 'formal',
  rules: 'Sempre citar a política aplicável.',
  restrictions: 'Não acessar dados bancários.',
  criticalInstructions: 'Escalonar qualquer suspeita de fraude.',
  modelProvider: 'openai',
  model: 'gpt-4o',
  fallbackModel: 'gpt-4o-mini',
  temperature: '0.4',
  responseFormat: 'Tópicos numerados.',
  positiveExamples: 'Pergunta válida -> resposta com fonte.',
  negativeExamples: 'Não inventar valores.',
  limits: 'Máximo de 300 palavras.',
  escalationPolicy: 'Encaminhar para a controladoria.',
  knowledgeBases: ['kb-policy', 'kb-process'],
  mcpTools: [],
  approvalActions: 'Pagamentos exigem aprovação humana.',
  environment: 'staging',
  legacyInstructions: '',
};

const assistantFrom = (configuration: unknown): Assistant => ({
  id: 'assistant-1',
  workspaceId: '7d335f83-4db7-41e8-a95d-ad576a314933',
  name: formData.name,
  description: formData.description,
  area: '',
  owner: 'owner-1',
  status: 'draft',
  model: formData.model,
  fallbackModel: formData.fallbackModel,
  temperature: Number(formData.temperature),
  version: '0.1.0',
  conversations: 0,
  costThisMonth: 0,
  satisfaction: 0,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  knowledgeBases: [],
  mcpTools: [],
  instructions: 'instruções compiladas',
  modelProvider: formData.modelProvider,
  configuration,
});

const binding = (knowledgeBaseId: string, isEnabled = true): AssistantKnowledgeBinding => ({
  id: `binding-${knowledgeBaseId}`,
  assistantId: 'assistant-1',
  knowledgeBaseId,
  isEnabled,
  retrievalMode: 'retrieval_placeholder',
  priority: 100,
  createdAt: '2026-07-28T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
});

describe('assistant Wizard serialization', () => {
  it('round-trips every structured field and hydrates Knowledge from enabled bindings', () => {
    const configuration = serializeWizardForm(formData);
    const hydrated = hydrateWizardForm(
      assistantFrom(configuration),
      [
        binding('kb-policy'),
        binding('kb-process'),
        binding('kb-disabled', false),
      ],
    );

    expect(configuration.schemaVersion).toBe(1);
    expect(configuration).not.toHaveProperty('knowledgeBases');
    expect(configuration).not.toHaveProperty('mcpTools');
    expect(hydrated).toEqual(formData);
  });

  it('compiles labeled sections in a deterministic order', () => {
    const instructions = compileAssistantInstructions(serializeWizardForm(formData));
    const headings = [
      '## Identidade',
      '## Objetivo',
      '## Persona',
      '## Tom e Voz',
      '## Regras',
      '## Modelo',
      '## Ferramentas',
      '## Formato',
      '## Exemplos',
      '## Limites',
    ];

    expect(instructions).toContain('### Tarefas proibidas\nNão aprovar pagamentos.');
    expect(instructions).toContain('### Instruções críticas\nEscalonar qualquer suspeita de fraude.');
    expect(instructions).toContain('### Negativos\nNão inventar valores.');

    const positions = headings.map(heading => instructions.indexOf(heading));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it('uses a conservative legacy fallback without treating workspace, description, or instructions as Wizard fields', () => {
    const assistant = assistantFrom(null);
    assistant.instructions = 'Prompt legado sem marcadores confiáveis.';

    const hydrated = hydrateLegacyWizardForm(assistant, [binding('kb-real')]);

    expect(hydrated.name).toBe(formData.name);
    expect(hydrated.description).toBe(formData.description);
    expect(hydrated.model).toBe(formData.model);
    expect(hydrated.temperature).toBe(formData.temperature);
    expect(hydrated.area).toBe('');
    expect(hydrated.area).not.toBe(assistant.workspaceId);
    expect(hydrated.objective).toBe('');
    expect(hydrated.tasks).toBe('');
    expect(hydrated.legacyInstructions).toBe('Prompt legado sem marcadores confiáveis.');
    expect(hydrated.knowledgeBases).toEqual(['kb-real']);
  });

  it('rejects unknown configuration schema versions', () => {
    expect(parseWizardConfiguration({ schemaVersion: 2, identity: { area: 'TI' } })).toBeNull();
  });
});
