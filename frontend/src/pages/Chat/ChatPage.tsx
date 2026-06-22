import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppShell } from '@/components/shared/AppShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAssistants } from '@/hooks/queries/useAssistants';
import { useConversations, useMessages } from '@/hooks/queries/useChat';
import { QueryState, ListLoading } from '@/components/shared/QueryState';
import { Bot, Send, Sparkles, Menu, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChatRunStateIndicator } from '@/components/chat/ChatRunStateIndicator';
import { ToolCallCard } from '@/components/chat/ToolCallCard';
import { RAGSourcesList } from '@/components/chat/RAGSourcesList';
import { FallbackBadge } from '@/components/chat/FallbackBadge';
import { ChatErrorState } from '@/components/chat/ChatErrorState';
import { FeedbackBar } from '@/components/chat/FeedbackBar';
import { env } from '@/lib/env';
import type { ChatRunState, MockRagSource, MockToolCall, ChatError, MessageFeedback } from '@/types/chat';

const DEMO_SOURCES: MockRagSource[] = [
  { id: 's1', documentName: 'Manual de Políticas RH v2026.pdf', knowledgeBase: 'Políticas de RH 2026', section: 'Seção 4.2 — Férias coletivas', page: 42, score: 0.92, excerpt: 'As férias coletivas devem ser comunicadas com no mínimo 15 dias de antecedência…' },
  { id: 's2', documentName: 'CLT Atualizada 2026.pdf', knowledgeBase: 'Legislação Trabalhista', section: 'Art. 139', page: 88, score: 0.78, excerpt: 'Poderão ser concedidas férias coletivas a todos os empregados ou a setores…' },
  { id: 's3', documentName: 'Benefícios Corporativos.pdf', knowledgeBase: 'Benefícios Corporativos', section: 'Capítulo 3', score: 0.55, excerpt: 'O plano odontológico cobre procedimentos básicos e ortodontia preventiva.' },
];

const DEMO_TOOL_RUNNING: MockToolCall = {
  id: 'tc1', name: 'query_hr_policy', friendlyName: 'Consulta de política de RH', domain: 'rh',
  status: 'running', input: { topic: 'férias coletivas', year: 2026 },
};
const DEMO_TOOL_SUCCESS: MockToolCall = {
  id: 'tc2', name: 'query_financial_report', friendlyName: 'Consulta de relatório financeiro', domain: 'financeiro',
  status: 'success', durationMs: 842,
  input: { period: 'Q1-2026', metric: 'EBITDA' },
  output: { value: 'R$ 12,4M', variation: '+12% vs Q4-2025', source_token: 'secret-removed' },
};
const DEMO_TOOL_ERROR: MockToolCall = {
  id: 'tc3', name: 'send_notification', friendlyName: 'Envio de notificação', domain: 'comunicação',
  status: 'error', durationMs: 1203, input: { channel: 'email', to: 'rh@empresa.com' },
  errorMessage: 'Falha de timeout ao contatar o serviço externo (mock).',
};

const DEMO_STATES: { state: ChatRunState; label: string }[] = [
  { state: 'idle',               label: 'Idle' },
  { state: 'sending',            label: 'Enviando' },
  { state: 'thinking',           label: 'IA pensando' },
  { state: 'retrieving_sources', label: 'Buscando fontes' },
  { state: 'executing_tool',     label: 'Executando tool' },
  { state: 'streaming',          label: 'Streaming' },
  { state: 'completed',          label: 'Concluído' },
  { state: 'fallback',           label: 'Fallback de modelo' },
  { state: 'failed',             label: 'Falha' },
];

const STREAM_TEXT = 'De acordo com a Política de RH 2026 (seção 4.2), as férias coletivas devem ser comunicadas com no mínimo 15 dias de antecedência e respeitar o período mínimo de 10 dias corridos…';

export default function ChatPage() {
  if (!env.useMocks) {
    return (
      <AppShell>
        <EmptyState
          icon={<FlaskConical className="h-6 w-6" />}
          title="Chat disponível apenas como protótipo"
          description="O contrato real de conversas ainda não está disponível. O modo de API real não renderiza mensagens, fontes ou tool calls de demonstração."
        />
      </AppShell>
    );
  }

  return <ChatPrototypePage />;
}

function ChatPrototypePage() {
  const assistantsQuery = useAssistants();
  const mockAssistants = assistantsQuery.data ?? [];
  const { data: mockConversations = [] } = useConversations();
  const { data: mockMessages = [] } = useMessages('default');
  const { assistantId } = useParams();
  const [inputValue, setInputValue] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState(assistantId || '');
  const publishedAssistants = mockAssistants.filter(a => a.status === 'published');

  // Demo / simulator state
  const [runState, setRunState] = useState<ChatRunState>('idle');
  const [showSources, setShowSources] = useState(false);
  const [showTool, setShowTool] = useState<'none' | 'running' | 'success' | 'error'>('none');
  const [showFallback, setShowFallback] = useState(false);
  const [chatError, setChatError] = useState<ChatError | null>(null);
  const [streamed, setStreamed] = useState('');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, MessageFeedback>>({});

  // Simulate streaming text when state is "streaming"
  useEffect(() => {
    if (runState !== 'streaming') return;
    setStreamed('');
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setStreamed(STREAM_TEXT.slice(0, i));
      if (i >= STREAM_TEXT.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [runState]);

  const applyScenario = (s: string) => {
    setChatError(null);
    setShowFallback(false);
    setShowSources(false);
    setShowTool('none');
    setStreamed('');
    switch (s) {
      case 'normal':         setRunState('completed'); break;
      case 'thinking':       setRunState('thinking'); break;
      case 'streaming':      setRunState('streaming'); break;
      case 'sources':        setRunState('completed'); setShowSources(true); break;
      case 'tool_running':   setRunState('executing_tool'); setShowTool('running'); break;
      case 'tool_success':   setRunState('completed'); setShowTool('success'); setShowSources(true); break;
      case 'tool_error':     setRunState('completed'); setShowTool('error'); break;
      case 'fallback':       setRunState('fallback'); setShowFallback(true); break;
      case 'no_sources':     setRunState('completed'); setChatError({ kind: 'no_sources_found' }); break;
      case 'provider_err':   setRunState('failed'); setChatError({ kind: 'provider_failure' }); break;
      case 'runtime_err':    setRunState('failed'); setChatError({ kind: 'runtime_failure' }); break;
      case 'tool_err_state': setRunState('failed'); setChatError({ kind: 'tool_failure' }); break;
      case 'sources_err':    setRunState('failed'); setChatError({ kind: 'sources_failure' }); break;
      case 'forbidden':      setRunState('failed'); setChatError({ kind: 'forbidden' }); break;
      default: setRunState('idle');
    }
  };

  const activeTool = useMemo<MockToolCall | null>(() => {
    if (showTool === 'running') return DEMO_TOOL_RUNNING;
    if (showTool === 'success') return DEMO_TOOL_SUCCESS;
    if (showTool === 'error')   return DEMO_TOOL_ERROR;
    return null;
  }, [showTool]);

  // Catalog view
  if (!selectedAssistant) {
    return (
      <AppShell>
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">Chat Workspace</h1>
            <p className="text-sm text-muted-foreground mt-1">Selecione um assistente para iniciar uma conversa</p>
          </div>
          <QueryState
            query={assistantsQuery}
            isEmpty={publishedAssistants.length === 0}
            loading={<ListLoading rows={3} />}
            emptyIcon={<Bot className="h-6 w-6" />}
            emptyTitle="Nenhum assistente publicado"
            emptyDescription="Publique um assistente para iniciar conversas. Rascunhos e arquivados não aparecem aqui."
            emptyAction={<Link to="/app/assistants"><Button variant="outline">Ir para Assistentes</Button></Link>}
            errorTitle="Não foi possível carregar os assistentes"
            errorDescription="Tente novamente em instantes."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publishedAssistants.map(a => (
                <button key={a.id} onClick={() => setSelectedAssistant(a.id)} className="text-left rounded-lg border bg-card p-5 hover:shadow-md hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{a.name}</h3>
                      <p className="text-xs text-muted-foreground">{a.area}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{a.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{a.model}</span>
                    <span>v{a.version}</span>
                  </div>
                </button>
              ))}
            </div>
          </QueryState>
        </div>
      </AppShell>
    );
  }

  const assistant = mockAssistants.find(a => a.id === selectedAssistant) || mockAssistants[0];

  const HistoryList = () => (
    <div className="flex-1 overflow-auto p-2 space-y-1">
      {mockConversations.map(c => (
        <button key={c.id} className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
          <p className="font-medium truncate text-card-foreground">{c.title}</p>
          <p className="text-xs text-muted-foreground truncate">{c.lastMessage.slice(0, 50)}…</p>
        </button>
      ))}
    </div>
  );

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-7.5rem)] gap-4 animate-fade-in">
        {/* Desktop history */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col rounded-lg border bg-card">
          <div className="border-b p-3">
            <button onClick={() => setSelectedAssistant('')} className="text-xs text-primary hover:underline">← Trocar assistente</button>
            <h3 className="font-semibold text-sm mt-2">Histórico</h3>
          </div>
          <HistoryList />
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col rounded-lg border bg-card overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 sm:px-4 py-3 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" aria-label="Abrir histórico">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 flex flex-col w-72">
                  <SheetHeader className="border-b p-3 text-left space-y-1">
                    <SheetTitle className="text-sm">Histórico</SheetTitle>
                    <button onClick={() => setSelectedAssistant('')} className="text-xs text-primary hover:underline">← Trocar assistente</button>
                  </SheetHeader>
                  <HistoryList />
                </SheetContent>
              </Sheet>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold truncate">{assistant.name}</h3>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>v{assistant.version}</span><span>·</span>
                  <span className="truncate">{assistant.model}</span><span>·</span>
                  <span>T: {assistant.temperature}</span>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <FlaskConical className="h-3.5 w-3.5" /> Cenário
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Simular estados de IA</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => applyScenario('normal')}>Resposta normal</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('thinking')}>IA pensando</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('streaming')}>Streaming</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('sources')}>Com fontes (RAG)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('tool_running')}>Tool executando</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('tool_success')}>Tool concluída + fontes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('tool_error')}>Tool falhou</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('fallback')}>Fallback de modelo</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Erros amigáveis</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => applyScenario('no_sources')}>Sem fontes encontradas</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('provider_err')}>Falha de provider</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('runtime_err')}>Falha de runtime</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('tool_err_state')}>Falha de tool</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('sources_err')}>Falha ao buscar fontes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyScenario('forbidden')}>Permissão insuficiente</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-4">
            {mockMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 ${
                  msg.role === 'user' ? 'gradient-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {msg.role === 'assistant' && (
                    <FeedbackBar
                      model={msg.model}
                      feedback={feedbackMap[msg.id]}
                      onChange={f => setFeedbackMap(m => ({ ...m, [msg.id]: f }))}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Demo assistant message reflecting current scenario */}
            {(runState !== 'idle' || showSources || activeTool || chatError || showFallback) && (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[75%] w-full rounded-xl px-4 py-3 bg-muted space-y-3">
                  {showFallback && (
                    <FallbackBadge fromModel={assistant.model} toModel={assistant.fallbackModel} />
                  )}

                  {activeTool && <ToolCallCard toolCall={activeTool} />}

                  {(runState === 'thinking' || runState === 'sending' || runState === 'retrieving_sources' || runState === 'executing_tool') && (
                    <ChatRunStateIndicator state={runState} />
                  )}

                  {runState === 'streaming' && (
                    <>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {streamed}
                        <span className="inline-block w-1.5 h-4 bg-primary/70 align-middle ml-0.5 animate-pulse" aria-hidden />
                      </div>
                      <ChatRunStateIndicator state="streaming" />
                    </>
                  )}

                  {runState === 'completed' && !chatError && (
                    <>
                      <div className="text-sm leading-relaxed">
                        {STREAM_TEXT}
                      </div>
                      {showSources && <RAGSourcesList sources={DEMO_SOURCES} />}
                      <div className="flex items-center justify-between pt-1">
                        <ChatRunStateIndicator state="completed" />
                      </div>
                      <FeedbackBar
                        model={showFallback ? assistant.fallbackModel : assistant.model}
                        feedback={feedbackMap['demo']}
                        onChange={f => setFeedbackMap(m => ({ ...m, demo: f }))}
                      />
                    </>
                  )}

                  {chatError && (
                    <ChatErrorState error={chatError} onRetry={() => applyScenario('completed')} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Digite sua mensagem..."
                aria-label="Mensagem"
                className="flex-1 bg-transparent text-sm outline-none min-w-0"
              />
              <Button
                size="sm"
                className="h-8 px-3 shrink-0"
                onClick={() => applyScenario('thinking')}
                aria-label="Enviar mensagem"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Protótipo visual — respostas, fontes e ferramentas são mockadas. Use “Cenário” para simular estados.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
