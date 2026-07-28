import type {
  Assistant,
  AssistantKnowledgeBinding,
  AssistantWizardFormData,
} from '@/types';

export interface AssistantWizardConfigurationV1 {
  schemaVersion: 1;
  identity: {
    area: string;
    environment: string;
  };
  objective: {
    main: string;
    tasks: string;
    prohibitedTasks: string;
  };
  persona: {
    description: string;
  };
  voice: {
    tone: string;
    humor: string;
    formality: string;
  };
  rules: {
    behavior: string;
    restrictions: string;
    criticalInstructions: string;
  };
  model: {
    fallbackModel: string;
  };
  tools: {
    approvalActions: string;
  };
  format: {
    responseFormat: string;
  };
  examples: {
    positive: string;
    negative: string;
  };
  limits: {
    limits: string;
    escalationPolicy: string;
  };
  legacy?: {
    instructions: string;
  };
}

export function createDefaultWizardForm(): AssistantWizardFormData {
  return {
    name: '',
    area: '',
    description: '',
    objective: '',
    tasks: '',
    prohibitedTasks: '',
    persona: '',
    tone: '',
    humor: '',
    formality: 'formal',
    rules: '',
    restrictions: '',
    criticalInstructions: '',
    modelProvider: 'openai',
    model: 'gpt-4o',
    fallbackModel: 'gpt-4o-mini',
    temperature: '0.3',
    responseFormat: '',
    positiveExamples: '',
    negativeExamples: '',
    limits: '',
    escalationPolicy: '',
    knowledgeBases: [],
    mcpTools: [],
    approvalActions: '',
    environment: 'staging',
    legacyInstructions: '',
  };
}

export function serializeWizardForm(
  formData: AssistantWizardFormData,
): AssistantWizardConfigurationV1 {
  const configuration: AssistantWizardConfigurationV1 = {
    schemaVersion: 1,
    identity: {
      area: formData.area,
      environment: formData.environment,
    },
    objective: {
      main: formData.objective,
      tasks: formData.tasks,
      prohibitedTasks: formData.prohibitedTasks,
    },
    persona: {
      description: formData.persona,
    },
    voice: {
      tone: formData.tone,
      humor: formData.humor,
      formality: formData.formality,
    },
    rules: {
      behavior: formData.rules,
      restrictions: formData.restrictions,
      criticalInstructions: formData.criticalInstructions,
    },
    model: {
      fallbackModel: formData.fallbackModel,
    },
    tools: {
      approvalActions: formData.approvalActions,
    },
    format: {
      responseFormat: formData.responseFormat,
    },
    examples: {
      positive: formData.positiveExamples,
      negative: formData.negativeExamples,
    },
    limits: {
      limits: formData.limits,
      escalationPolicy: formData.escalationPolicy,
    },
  };

  if (formData.legacyInstructions?.trim()) {
    configuration.legacy = { instructions: formData.legacyInstructions };
  }

  return configuration;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringValue = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' ? record[key] as string : '';

const childRecord = (record: Record<string, unknown>, key: string) =>
  isRecord(record[key]) ? record[key] as Record<string, unknown> : {};

export function parseWizardConfiguration(
  value: unknown,
): AssistantWizardConfigurationV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;

  const identity = childRecord(value, 'identity');
  const objective = childRecord(value, 'objective');
  const persona = childRecord(value, 'persona');
  const voice = childRecord(value, 'voice');
  const rules = childRecord(value, 'rules');
  const model = childRecord(value, 'model');
  const tools = childRecord(value, 'tools');
  const format = childRecord(value, 'format');
  const examples = childRecord(value, 'examples');
  const limits = childRecord(value, 'limits');
  const legacy = childRecord(value, 'legacy');
  const legacyInstructions = stringValue(legacy, 'instructions');

  return {
    schemaVersion: 1,
    identity: {
      area: stringValue(identity, 'area'),
      environment: stringValue(identity, 'environment'),
    },
    objective: {
      main: stringValue(objective, 'main'),
      tasks: stringValue(objective, 'tasks'),
      prohibitedTasks: stringValue(objective, 'prohibitedTasks'),
    },
    persona: {
      description: stringValue(persona, 'description'),
    },
    voice: {
      tone: stringValue(voice, 'tone'),
      humor: stringValue(voice, 'humor'),
      formality: stringValue(voice, 'formality'),
    },
    rules: {
      behavior: stringValue(rules, 'behavior'),
      restrictions: stringValue(rules, 'restrictions'),
      criticalInstructions: stringValue(rules, 'criticalInstructions'),
    },
    model: {
      fallbackModel: stringValue(model, 'fallbackModel'),
    },
    tools: {
      approvalActions: stringValue(tools, 'approvalActions'),
    },
    format: {
      responseFormat: stringValue(format, 'responseFormat'),
    },
    examples: {
      positive: stringValue(examples, 'positive'),
      negative: stringValue(examples, 'negative'),
    },
    limits: {
      limits: stringValue(limits, 'limits'),
      escalationPolicy: stringValue(limits, 'escalationPolicy'),
    },
    ...(legacyInstructions ? { legacy: { instructions: legacyInstructions } } : {}),
  };
}

function compileSection(
  heading: string,
  fields: Array<[label: string, value: string]>,
): string | null {
  const populatedFields = fields.filter(([, value]) => value.trim().length > 0);
  if (populatedFields.length === 0) return null;
  return [
    `## ${heading}`,
    ...populatedFields.map(([label, value]) => `### ${label}\n${value.trim()}`),
  ].join('\n\n');
}

export function compileAssistantInstructions(
  configuration: AssistantWizardConfigurationV1,
): string {
  return [
    compileSection('Identidade', [
      ['Área / Departamento', configuration.identity.area],
      ['Ambiente', configuration.identity.environment],
    ]),
    compileSection('Objetivo', [
      ['Objetivo principal', configuration.objective.main],
      ['Tarefas permitidas', configuration.objective.tasks],
      ['Tarefas proibidas', configuration.objective.prohibitedTasks],
    ]),
    compileSection('Persona', [
      ['Descrição', configuration.persona.description],
    ]),
    compileSection('Tom e Voz', [
      ['Tom', configuration.voice.tone],
      ['Humor', configuration.voice.humor],
      ['Formalidade', configuration.voice.formality],
    ]),
    compileSection('Regras', [
      ['Comportamento', configuration.rules.behavior],
      ['Restrições', configuration.rules.restrictions],
      ['Instruções críticas', configuration.rules.criticalInstructions],
    ]),
    compileSection('Modelo', [
      ['Modelo fallback', configuration.model.fallbackModel],
    ]),
    compileSection('Ferramentas', [
      ['Ações que exigem aprovação', configuration.tools.approvalActions],
    ]),
    compileSection('Formato', [
      ['Formato de resposta', configuration.format.responseFormat],
    ]),
    compileSection('Exemplos', [
      ['Positivos', configuration.examples.positive],
      ['Negativos', configuration.examples.negative],
    ]),
    compileSection('Limites', [
      ['Limites de atuação', configuration.limits.limits],
      ['Política de escalonamento', configuration.limits.escalationPolicy],
    ]),
    configuration.legacy
      ? compileSection('Instruções legadas preservadas', [
          ['Conteúdo da versão anterior', configuration.legacy.instructions],
        ])
      : null,
  ].filter((section): section is string => Boolean(section)).join('\n\n');
}

export function hydrateLegacyWizardForm(
  assistant: Assistant,
  bindings: AssistantKnowledgeBinding[] = [],
): AssistantWizardFormData {
  return {
    ...createDefaultWizardForm(),
    name: assistant.name,
    description: assistant.description,
    modelProvider: assistant.modelProvider || inferModelProvider(assistant.model),
    model: assistant.model || 'gpt-4o',
    fallbackModel: assistant.fallbackModel || assistant.model || 'gpt-4o-mini',
    temperature: String(assistant.temperature ?? 0.3),
    knowledgeBases: bindings
      .filter(binding => binding.isEnabled)
      .map(binding => binding.knowledgeBaseId),
    legacyInstructions: assistant.instructions ?? '',
  };
}

export function hydrateWizardForm(
  assistant: Assistant,
  bindings: AssistantKnowledgeBinding[] = [],
): AssistantWizardFormData {
  const configuration = parseWizardConfiguration(assistant.configuration);
  if (!configuration) return hydrateLegacyWizardForm(assistant, bindings);

  return {
    ...createDefaultWizardForm(),
    name: assistant.name,
    description: assistant.description,
    area: configuration.identity.area,
    environment: configuration.identity.environment || 'staging',
    objective: configuration.objective.main,
    tasks: configuration.objective.tasks,
    prohibitedTasks: configuration.objective.prohibitedTasks,
    persona: configuration.persona.description,
    tone: configuration.voice.tone,
    humor: configuration.voice.humor,
    formality: configuration.voice.formality || 'formal',
    rules: configuration.rules.behavior,
    restrictions: configuration.rules.restrictions,
    criticalInstructions: configuration.rules.criticalInstructions,
    modelProvider: assistant.modelProvider || inferModelProvider(assistant.model),
    model: assistant.model || 'gpt-4o',
    fallbackModel: configuration.model.fallbackModel || assistant.model || 'gpt-4o-mini',
    temperature: String(assistant.temperature ?? 0.3),
    approvalActions: configuration.tools.approvalActions,
    responseFormat: configuration.format.responseFormat,
    positiveExamples: configuration.examples.positive,
    negativeExamples: configuration.examples.negative,
    limits: configuration.limits.limits,
    escalationPolicy: configuration.limits.escalationPolicy,
    knowledgeBases: bindings
      .filter(binding => binding.isEnabled)
      .map(binding => binding.knowledgeBaseId),
    mcpTools: [],
    legacyInstructions: configuration.legacy?.instructions ?? '',
  };
}

export function inferModelProvider(modelName: string): string {
  if (modelName.includes('claude')) return 'anthropic';
  if (modelName.includes('gemini')) return 'google';
  return 'openai';
}
