import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useAssistant,
  useAssistantModelCatalog,
  useCreateAssistantMutation,
  useUpdateAssistantMutation,
} from '@/hooks/queries/useAssistants';
import { useAssistantKnowledgeBindings, useKnowledgeBases } from '@/hooks/queries/useKnowledge';
import { useMcpTools } from '@/hooks/queries/useMcp';
import { useCurrentSession } from '@/hooks/queries/useAuth';
import {
  createDefaultWizardForm,
  hydrateWizardForm,
} from './assistantWizard.serialization';
import { AssistantWizardSaveError } from '@/services/assistants.service';
import { toast } from 'sonner';
import type { AssistantWizardFormData } from '@/types';
import {
  ArrowLeft, ArrowRight, Check, Bot, Target, User, MessageCircle,
  ShieldCheck, Cpu, BookOpen, Server, FileText, Lightbulb, AlertTriangle,
  Eye, CheckCircle, XCircle, Sparkles, Info, Send
} from 'lucide-react';

const steps = [
  { label: 'Identidade', icon: Bot, description: 'Defina o nome, área e descrição do assistente' },
  { label: 'Objetivo', icon: Target, description: 'Estabeleça o objetivo, tarefas permitidas e proibidas' },
  { label: 'Persona', icon: User, description: 'Configure a personalidade e identidade do assistente' },
  { label: 'Tom e Voz', icon: MessageCircle, description: 'Ajuste tom de voz, humor e formalidade' },
  { label: 'Regras', icon: ShieldCheck, description: 'Defina regras, restrições e instruções críticas' },
  { label: 'Modelos', icon: Cpu, description: 'Escolha os modelos de IA e parâmetros' },
  { label: 'Conhecimento', icon: BookOpen, description: 'Vincule bases de conhecimento para RAG' },
  { label: 'Ferramentas', icon: Server, description: 'Habilite ferramentas MCP e defina aprovações' },
  { label: 'Formato', icon: FileText, description: 'Configure o formato das respostas' },
  { label: 'Exemplos', icon: Lightbulb, description: 'Forneça exemplos positivos e negativos' },
  { label: 'Limites', icon: AlertTriangle, description: 'Defina limites e política de escalonamento' },
  { label: 'Revisão', icon: Eye, description: 'Revise todas as configurações antes de salvar' },
];

export default function AssistantWizardPage() {
  const createAssistantMutation = useCreateAssistantMutation();
  const updateAssistantMutation = useUpdateAssistantMutation();
  const { data: mockKnowledgeBases = [] } = useKnowledgeBases();
  const { data: mockMcpTools = [] } = useMcpTools();
  const sessionQuery = useCurrentSession();
  const modelCatalogQuery = useAssistantModelCatalog();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const assistantQuery = useAssistant(isEditing ? id : undefined);
  const bindingsQuery = useAssistantKnowledgeBindings(isEditing ? id : undefined);
  const canBindKnowledge = sessionQuery.data?.permissions.includes('knowledge.bind') ?? false;

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<AssistantWizardFormData>(() => createDefaultWizardForm());
  const [hydratedAssistantId, setHydratedAssistantId] = useState<string | null>(null);
  const isHydrated = !isEditing || hydratedAssistantId === assistantQuery.data?.id;

  useEffect(() => {
    if (
      assistantQuery.data
      && !bindingsQuery.isLoading
      && !bindingsQuery.isError
      && hydratedAssistantId !== assistantQuery.data.id
    ) {
      setFormData(hydrateWizardForm(assistantQuery.data, bindingsQuery.data ?? []));
      setHydratedAssistantId(assistantQuery.data.id);
    }
  }, [
    assistantQuery.data,
    bindingsQuery.data,
    bindingsQuery.isError,
    bindingsQuery.isLoading,
    hydratedAssistantId,
  ]);

  const update = (field: keyof AssistantWizardFormData, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const toggleArrayItem = (field: 'knowledgeBases' | 'mcpTools', itemId: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(itemId)
        ? prev[field].filter(id => id !== itemId)
        : [...prev[field], itemId],
    }));
  };

  const modelOptions = useMemo(
    () => (modelCatalogQuery.data ?? []).map((item) => ({
      value: item.model,
      provider: item.provider,
      label: item.label,
      isDefault: item.isDefault,
      desc: item.isDefault
        ? 'Modelo padrão disponível neste ambiente'
        : 'Modelo disponível neste ambiente',
    })),
    [modelCatalogQuery.data],
  );

  useEffect(() => {
    if (isEditing) return;

    const catalog = modelCatalogQuery.data ?? [];
    if (catalog.length === 0) return;

    setFormData((previous) => {
      const current = catalog.find(
        (item) =>
          item.provider === previous.modelProvider
          && item.model === previous.model,
      );

      const selected =
        current
        ?? catalog.find((item) => item.isDefault)
        ?? catalog[0];

      if (
        previous.modelProvider === selected.provider
        && previous.model === selected.model
        && previous.fallbackModel === ''
      ) {
        return previous;
      }

      return {
        ...previous,
        modelProvider: selected.provider,
        model: selected.model,
        fallbackModel: '',
      };
    });
  }, [isEditing, modelCatalogQuery.data]);

  // Scoring
  const scores = useMemo(() => {
    const fields = [
      formData.name, formData.area, formData.description, formData.objective,
      formData.tasks, formData.prohibitedTasks, formData.persona, formData.tone,
      formData.rules, formData.restrictions, formData.criticalInstructions,
      formData.responseFormat, formData.positiveExamples, formData.negativeExamples,
      formData.limits, formData.escalationPolicy,
    ];
    const filled = fields.filter(v => v && v.length > 0).length;
    const robustness = Math.min(100, Math.round((filled / fields.length) * 100));
    const hasRestrictions = formData.restrictions.length > 10;
    const hasRules = formData.rules.length > 10;
    const hasCritical = formData.criticalInstructions.length > 10;
    const riskScore = hasRestrictions && hasRules && hasCritical ? 'Baixo' : hasRules || hasRestrictions ? 'Médio' : 'Alto';
    const riskColor = riskScore === 'Baixo' ? 'text-success' : riskScore === 'Médio' ? 'text-warning' : 'text-destructive';
    const coverage = Math.min(100, Math.round(
      (formData.knowledgeBases.length > 0 ? 34 : 0)
      + (formData.positiveExamples.length > 0 ? 33 : 0)
      + (formData.responseFormat.length > 0 ? 33 : 0),
    ));
    return { robustness, riskScore, riskColor, coverage };
  }, [formData]);

  // Validation
  const stepValidation = useMemo(() => {
    return steps.map((_, i) => {
      switch (i) {
        case 0: return formData.name.length > 0 && formData.area.length > 0;
        case 1: return formData.objective.length > 0;
        case 2: return true;
        case 3: return true;
        case 4: return true;
        case 5:
          return modelOptions.some(
            (option) => option.value === formData.model,
          );
        case 6: return true;
        case 7: return true;
        case 8: return true;
        case 9: return true;
        case 10: return true;
        case 11: return formData.name.length > 0 && formData.area.length > 0 && formData.objective.length > 0;
        default: return true;
      }
    });
  }, [formData, modelOptions]);

  const handleSave = async (publish: boolean) => {
    if (!modelOptions.some((option) => option.value === formData.model)) {
      toast.error('Modelo indisponível', {
        description: 'Selecione um modelo realmente disponível neste ambiente.',
      });
      return;
    }

    try {
      if (isEditing && id) {
        await updateAssistantMutation.mutateAsync({
          id,
          formData,
          publish,
          syncKnowledgeBindings: canBindKnowledge,
        });
      } else {
        await createAssistantMutation.mutateAsync({
          formData,
          publish,
          syncKnowledgeBindings: canBindKnowledge,
        });
      }
      toast.success(
        publish ? `Assistente "${formData.name}" publicado com sucesso!` : `Assistente "${formData.name}" salvo como rascunho!`,
        { description: isEditing ? 'Alteracoes salvas' : 'Assistente criado' }
      );
      navigate('/app/assistants');
    } catch (error) {
      if (error instanceof AssistantWizardSaveError) {
        toast.error('Salvamento parcial', {
          description: error.message,
          duration: 8000,
        });
        if (!isEditing) {
          navigate(`/app/assistants/${error.assistantId}/edit`);
        }
        return;
      }
      toast.error('Não foi possível salvar o assistente', {
        description: 'O assistente não foi publicado. Revise os dados e tente novamente.',
      });
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Assistente <span className="text-destructive">*</span></Label>
              <Input id="name" placeholder="Ex: Analista RH, Copiloto Financeiro" value={formData.name} onChange={e => update('name', e.target.value)} />
              <p className="text-xs text-muted-foreground">Escolha um nome claro que identifique a função do assistente.</p>
            </div>
            <div className="space-y-2">
              <Label>Área / Departamento <span className="text-destructive">*</span></Label>
              <Select value={formData.area} onValueChange={v => update('area', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent>
                  {['Recursos Humanos', 'Jurídico', 'Financeiro', 'Comercial', 'Operações', 'TI', 'Compliance', 'Diretoria', 'Atendimento Interno'].map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea id="desc" placeholder="Descreva brevemente o que este assistente faz e qual problema resolve..." value={formData.description} onChange={e => update('description', e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={formData.environment} onValueChange={v => update('environment', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Staging para testes, Production para uso final.</p>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Objetivo principal <span className="text-destructive">*</span></Label>
              <Textarea placeholder="Qual é o objetivo central deste assistente? O que ele resolve para o usuário?" value={formData.objective} onChange={e => update('objective', e.target.value)} rows={3} />
              <Hint>Seja específico. Ex: "Responder dúvidas sobre políticas de RH com base na documentação oficial."</Hint>
            </div>
            <div className="space-y-2">
              <Label>Tarefas que deve executar</Label>
              <Textarea placeholder="Liste as tarefas, uma por linha..." value={formData.tasks} onChange={e => update('tasks', e.target.value)} rows={4} />
              <Hint>Ex: Consultar políticas de férias, Orientar sobre benefícios, Informar sobre processos de admissão</Hint>
            </div>
            <div className="space-y-2">
              <Label>Tarefas que NÃO deve executar</Label>
              <Textarea placeholder="Liste as tarefas proibidas, uma por linha..." value={formData.prohibitedTasks} onChange={e => update('prohibitedTasks', e.target.value)} rows={4} />
              <Hint>Ex: Nunca fornecer valores salariais individuais, Não fazer promessas sobre promoções</Hint>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Persona</Label>
              <Textarea placeholder="Descreva a persona que o assistente deve adotar. Quem ele é? Qual sua experiência?" value={formData.persona} onChange={e => update('persona', e.target.value)} rows={4} />
              <Hint>Ex: "Profissional de RH experiente com 15 anos de vivência em empresas de grande porte, empático e acolhedor."</Hint>
            </div>
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" /> Dica</p>
              <p className="text-sm mt-1 text-muted-foreground">Uma persona bem definida ajuda o LLM a manter consistência no comportamento. Inclua experiência, estilo de comunicação e valores.</p>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Tom de voz</Label>
              <Input placeholder="Ex: Formal e acolhedor, Técnico e preciso, Direto e analítico" value={formData.tone} onChange={e => update('tone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Humor</Label>
              <Select value={formData.humor || 'neutro'} onValueChange={v => update('humor', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum — sem humor</SelectItem>
                  <SelectItem value="neutro">Neutro — humor ocasional leve</SelectItem>
                  <SelectItem value="leve">Leve — bem-humorado mas profissional</SelectItem>
                  <SelectItem value="moderado">Moderado — usa humor com frequência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formalidade</Label>
              <Select value={formData.formality} onValueChange={v => update('formality', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="muito_formal">Muito formal — linguagem jurídica/acadêmica</SelectItem>
                  <SelectItem value="formal">Formal — profissional padrão</SelectItem>
                  <SelectItem value="neutro">Neutro — equilibrado</SelectItem>
                  <SelectItem value="informal">Informal — coloquial e amigável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted/30 p-4 flex gap-4">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview do tom</p>
                <p className="text-sm italic text-foreground">
                  {formData.formality === 'muito_formal' && '"Conforme disposto na norma vigente, informo que..."'}
                  {formData.formality === 'formal' && '"De acordo com nossas políticas, gostaria de informar que..."'}
                  {formData.formality === 'neutro' && '"Olá! Com base nas informações disponíveis..."'}
                  {formData.formality === 'informal' && '"Oi! Deixa eu te explicar como funciona..."'}
                  {!formData.formality && '"De acordo com nossas políticas..."'}
                </p>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Regras de comportamento</Label>
              <Textarea placeholder="Defina regras que o assistente deve sempre seguir, uma por linha..." value={formData.rules} onChange={e => update('rules', e.target.value)} rows={5} />
              <Hint>Ex: Sempre citar a fonte da informação, Se não souber, indicar o canal correto</Hint>
            </div>
            <div className="space-y-2">
              <Label>Restrições</Label>
              <Textarea placeholder="O que o assistente nunca deve fazer, uma por linha..." value={formData.restrictions} onChange={e => update('restrictions', e.target.value)} rows={5} />
              <Hint>Ex: Não acessar dados salariais, Não tomar decisões em nome do departamento</Hint>
            </div>
            <div className="space-y-2">
              <Label>Instruções críticas</Label>
              <Textarea placeholder="Instruções que SEMPRE devem ser respeitadas, independente do contexto..." value={formData.criticalInstructions} onChange={e => update('criticalInstructions', e.target.value)} rows={3} />
              <div className="rounded-lg bg-warning/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">Instruções críticas são inseridas com prioridade máxima no prompt. Use para regras que nunca podem ser violadas.</p>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Modelo principal</Label>
              {modelCatalogQuery.isLoading ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Consultando modelos disponíveis neste ambiente...
                </div>
              ) : modelCatalogQuery.isError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">
                    Não foi possível consultar o catálogo de modelos
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O Wizard permanece bloqueado até que o backend confirme
                    os modelos realmente disponíveis.
                  </p>
                </div>
              ) : modelOptions.length === 0 ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-medium">
                    Nenhum modelo disponível
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O backend não informou um modelo LLM configurado para
                    este ambiente.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {modelOptions.map((model) => (
                    <label
                      key={model.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        formData.model === model.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        checked={formData.model === model.value}
                        onChange={() =>
                          setFormData((previous) => ({
                            ...previous,
                            model: model.value,
                            modelProvider: model.provider,
                            fallbackModel: '',
                          }))
                        }
                        className="accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium">{model.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Modelo fallback</Label>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-medium">Não configurado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Não existe atualmente um segundo modelo real disponível
                  para funcionar como fallback.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temperatura: {formData.temperature}</Label>
              </div>
              <Slider
                value={[parseFloat(formData.temperature)]}
                onValueChange={v => update('temperature', v[0].toFixed(1))}
                min={0} max={1} step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.0 — Determinístico</span>
                <span>0.5 — Equilibrado</span>
                <span>1.0 — Criativo</span>
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Selecione as bases de conhecimento que este assistente poderá consultar via RAG.</p>
              {!canBindKnowledge && (
                <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  Você não possui a permissão <code>knowledge.bind</code>. Os vínculos atuais serão preservados e esta etapa ficará somente para consulta.
                </div>
              )}
              <div className="space-y-2">
                {mockKnowledgeBases.map(kb => (
                  <label key={kb.id} className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${canBindKnowledge ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} ${formData.knowledgeBases.includes(kb.id) ? 'border-primary bg-primary/5' : canBindKnowledge ? 'hover:bg-muted/50' : ''}`}>
                    <input type="checkbox" checked={formData.knowledgeBases.includes(kb.id)} disabled={!canBindKnowledge} onChange={() => toggleArrayItem('knowledgeBases', kb.id)} className="rounded accent-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{kb.name}</p>
                        <span className="text-[10px] text-muted-foreground">{kb.classification}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{kb.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{kb.documentCount} docs · {kb.totalChunks.toLocaleString()} chunks · {kb.size}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-info/10 p-3 flex items-start gap-2">
              <BookOpen className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <p className="text-xs text-info">
                {formData.knowledgeBases.length} base(s) vinculada(s).
                {canBindKnowledge ? ' As alterações serão sincronizadas antes de uma eventual publicação.' : ' Nenhuma alteração de vínculo será enviada.'}
              </p>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-5">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Bindings MCP não são alterados pelo Wizard nesta fase. A lista abaixo é somente informativa e nenhuma ferramenta, discovery, readiness ou execução MCP será chamada.
            </div>
            <div className="space-y-2">
              {mockMcpTools.map(tool => (
                <label key={tool.id} className="flex cursor-not-allowed items-center justify-between rounded-lg border p-3 opacity-70">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={false} disabled className="rounded accent-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{tool.name}</span>
                        <StatusBadge status={tool.riskLevel} />
                      </div>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                  {tool.requiresApproval && (
                    <span className="flex items-center gap-1 text-[10px] text-warning shrink-0 ml-2">
                      <AlertTriangle className="h-3 w-3" />Requer aprovação
                    </span>
                  )}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Ações que exigem aprovação adicional</Label>
              <Textarea placeholder="Liste ações sensíveis que devem exigir aprovação humana antes de executar..." value={formData.approvalActions} onChange={e => update('approvalActions', e.target.value)} rows={3} />
            </div>
          </div>
        );
      case 8:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Formato de resposta padrão</Label>
              <Textarea placeholder="Descreva como as respostas devem ser formatadas. Ex: bullet points, parágrafos curtos, tabelas..." value={formData.responseFormat} onChange={e => update('responseFormat', e.target.value)} rows={5} />
              <Hint>Ex: "Respostas estruturadas com tópicos numerados, citação de fonte ao final, máximo 300 palavras."</Hint>
            </div>
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Sugestões de formato</p>
              <div className="flex flex-wrap gap-2">
                {['Tópicos numerados', 'Bullet points', 'Parágrafos curtos', 'Tabela quando possível', 'Sempre citar fonte', 'Máximo 300 palavras'].map(s => (
                  <button key={s} onClick={() => update('responseFormat', formData.responseFormat + (formData.responseFormat ? '\n' : '') + s)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted transition-colors">{s}</button>
                ))}
              </div>
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Exemplos positivos (como deve responder)</Label>
              <Textarea placeholder="Forneça exemplos de perguntas e boas respostas esperadas..." value={formData.positiveExamples} onChange={e => update('positiveExamples', e.target.value)} rows={6} />
              <Hint>Formato sugerido: "Pergunta: ...\nResposta: ..."</Hint>
            </div>
            <div className="space-y-2">
              <Label>Exemplos negativos (como NÃO deve responder)</Label>
              <Textarea placeholder="Forneça exemplos de perguntas e respostas indesejadas..." value={formData.negativeExamples} onChange={e => update('negativeExamples', e.target.value)} rows={6} />
              <Hint>Ajuda o modelo a entender limites claros de comportamento.</Hint>
            </div>
          </div>
        );
      case 10:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Limites de atuação</Label>
              <Textarea placeholder="Defina os limites de atuação do assistente..." value={formData.limits} onChange={e => update('limits', e.target.value)} rows={4} />
              <Hint>Ex: "Máximo de 2000 tokens por resposta. Escalonar para humano após 3 tentativas sem resolução."</Hint>
            </div>
            <div className="space-y-2">
              <Label>Política de escalonamento</Label>
              <Textarea placeholder="Quando e como o assistente deve escalonar para um humano..." value={formData.escalationPolicy} onChange={e => update('escalationPolicy', e.target.value)} rows={4} />
              <Hint>Ex: "Se não encontrar resposta na base, encaminhar para rh@empresa.com com resumo da dúvida."</Hint>
            </div>
          </div>
        );
      case 11:
        return <ReviewStep formData={formData} scores={scores} stepValidation={stepValidation} />;
      default:
        return null;
    }
  };

  if (
    isEditing
    && (
      assistantQuery.isError
      || bindingsQuery.isError
      || (!assistantQuery.isLoading && !assistantQuery.data)
    )
  ) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-lg border bg-card p-6">
          <h1 className="text-lg font-semibold">Não foi possível abrir o Wizard com segurança</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O detalhe do assistente ou seus vínculos reais de conhecimento não puderam ser carregados. Nenhuma alteração foi enviada.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/app/assistants')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isEditing && (assistantQuery.isLoading || bindingsQuery.isLoading || !isHydrated)) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl py-16 text-center text-sm text-muted-foreground">
          Carregando configuração e vínculos do assistente...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl animate-fade-in">
        <button onClick={() => navigate('/app/assistants')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Assistants
        </button>
        <h1 className="text-2xl font-bold mb-1">{isEditing ? `Editar: ${formData.name || 'Assistente'}` : 'Criar Assistente'}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isEditing ? 'Atualize as configurações do assistente.' : 'Configure seu assistente corporativo em etapas guiadas.'}
        </p>

        <div className="flex gap-8">
          {/* Stepper sidebar */}
          <div className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-1">
              <nav className="space-y-0.5">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = i === currentStep;
                  const isDone = i < currentStep;
                  const isValid = stepValidation[i];
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-primary/10 text-primary font-medium' :
                        isDone ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs shrink-0 ${
                        isActive ? 'gradient-primary text-primary-foreground' :
                        isDone && isValid ? 'bg-success text-success-foreground' :
                        isDone && !isValid ? 'bg-warning text-warning-foreground' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isDone && isValid ? <Check className="h-3 w-3" /> : isDone && !isValid ? <AlertTriangle className="h-3 w-3" /> : i + 1}
                      </div>
                      <span className="truncate">{step.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 rounded-lg border bg-muted/30 p-4 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scores</h4>
                <ScoreBar label="Robustez" value={scores.robustness} color="primary" />
                <ScoreBar label="Cobertura" value={scores.coverage} color="info" />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Risco</span>
                  <span className={`font-semibold ${scores.riskColor}`}>{scores.riskScore}</span>
                </div>
                <div className="border-t pt-3 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preview</p>
                  {formData.name && <p className="text-sm font-semibold">{formData.name}</p>}
                  {formData.area && <p className="text-xs text-muted-foreground">{formData.area}</p>}
                  {formData.model && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{modelOptions.find(m => m.value === formData.model)?.label || formData.model}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile progress */}
            <div className="lg:hidden mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Etapa {currentStep + 1} de {steps.length}</span>
                <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4 sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {(() => { const Icon = steps[currentStep].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                  {steps[currentStep].label}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{steps[currentStep].description}</p>
              </div>
              {formData.legacyInstructions && (
                <div className="mb-5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  Esta versão é legada e não possui <code>configuration</code> estruturada. Os campos não foram inventados; as instruções anteriores serão preservadas em uma seção legada ao salvar.
                </div>
              )}
              {renderStepContent()}
            </div>

            {/* Navigation */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
                {currentStep === steps.length - 1 ? (
                  <>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => { void handleSave(false); }}
                      disabled={createAssistantMutation.isPending || updateAssistantMutation.isPending}
                    >
                      Salvar Rascunho
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => { void handleSave(true); }}
                      disabled={!stepValidation[11] || createAssistantMutation.isPending || updateAssistantMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-1" /> Publicar
                    </Button>
                  </>
                ) : (
                  <Button className="w-full sm:w-auto" onClick={() => setCurrentStep(currentStep + 1)}>
                    Próximo <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground flex items-start gap-1"><Info className="h-3 w-3 shrink-0 mt-0.5" />{children}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    low: 'bg-success/10 text-success', medium: 'bg-warning/10 text-warning',
    high: 'bg-destructive/10 text-destructive', critical: 'bg-destructive/15 text-destructive',
  };
  const labels: Record<string, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto', critical: 'Crítico' };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || 'bg-muted text-muted-foreground'}`}>{labels[status] || status}</span>;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClass = color === 'primary' ? 'gradient-primary' : color === 'info' ? 'bg-info' : 'bg-success';
  const textClass = color === 'primary' ? 'text-primary' : color === 'info' ? 'text-info' : 'text-success';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${textClass}`}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ReviewStep({ formData, scores, stepValidation }: {
  formData: AssistantWizardFormData;
  scores: { robustness: number; riskScore: string; riskColor: string; coverage: number };
  stepValidation: boolean[];
}) {
  const modelLabels: Record<string, string> = {
    'gpt-4o-mini': 'GPT-4o Mini',
  };

  const checklist = [
    { label: 'Nome definido', ok: formData.name.length > 0 },
    { label: 'Área selecionada', ok: formData.area.length > 0 },
    { label: 'Objetivo definido', ok: formData.objective.length > 0 },
    { label: 'Persona configurada', ok: formData.persona.length > 0 },
    { label: 'Regras definidas', ok: formData.rules.length > 0 },
    { label: 'Restrições definidas', ok: formData.restrictions.length > 0 },
    { label: 'Instruções críticas', ok: formData.criticalInstructions.length > 0 },
    { label: 'Bases de conhecimento', ok: formData.knowledgeBases.length > 0 },
    { label: 'Formato de resposta', ok: formData.responseFormat.length > 0 },
    { label: 'Exemplos positivos', ok: formData.positiveExamples.length > 0 },
    { label: 'Limites definidos', ok: formData.limits.length > 0 },
  ];

  const completedCount = checklist.filter(c => c.ok).length;

  return (
    <div className="space-y-5">
      {/* Scores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-lg border p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Robustez</p>
          <p className="text-3xl font-bold text-primary">{scores.robustness}%</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Risco</p>
          <p className={`text-3xl font-bold ${scores.riskColor}`}>{scores.riskScore}</p>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cobertura</p>
          <p className="text-3xl font-bold text-info">{scores.coverage}%</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-muted/30 p-4 sm:p-5 space-y-3">
        <h4 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Resumo do Assistente</h4>
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <ReviewField label="Nome" value={formData.name} />
          <ReviewField label="Área" value={formData.area} />
          <ReviewField label="Ambiente" value={formData.environment} />
          <ReviewField label="Modelo" value={modelLabels[formData.model] || formData.model} />
          <ReviewField label="Fallback" value={modelLabels[formData.fallbackModel] || formData.fallbackModel} />
          <ReviewField label="Temperatura" value={formData.temperature} />
          <ReviewField label="Tom" value={formData.tone} />
          <ReviewField label="Humor" value={formData.humor} />
          <ReviewField label="Formalidade" value={formData.formality} />
          <ReviewField label="Bases de conhecimento" value={`${formData.knowledgeBases.length} selecionada(s)`} />
          <ReviewField label="Bindings MCP" value="Não alterados por este Wizard" />
        </div>
        {formData.objective && (
          <div className="border-t pt-2">
            <p className="text-xs text-muted-foreground">Objetivo</p>
            <p className="text-sm">{formData.objective}</p>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="rounded-lg border p-4 sm:p-5">
        <h4 className="font-semibold mb-3">Checklist antes de publicar ({completedCount}/{checklist.length})</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {checklist.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.ok ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
