/**
 * Tipos da experiência de Chat / IA.
 *
 * NOTA: Tudo aqui é estrutura visual/conceitual para o protótipo.
 * Não há runtime real, RAG real ou MCP real. Os dados são mockados
 * e nunca devem conter secrets, tokens ou credenciais.
 */

export type ChatRunState =
  | 'idle'
  | 'sending'
  | 'thinking'
  | 'streaming'
  | 'retrieving_sources'
  | 'executing_tool'
  | 'completed'
  | 'failed'
  | 'fallback';

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

export interface MockToolCall {
  id: string;
  name: string;
  friendlyName?: string;
  domain?: string; // ex: 'rh', 'financeiro', 'operacional'
  status: ToolCallStatus;
  /** Duração mockada em ms */
  durationMs?: number;
  /** Input mockado e sanitizado (sem secrets) */
  input?: Record<string, unknown>;
  /** Output mockado e sanitizado */
  output?: unknown;
  errorMessage?: string;
}

export interface MockRagSource {
  id: string;
  documentName: string;
  knowledgeBase: string;
  section?: string;
  page?: number;
  /** Score mockado (0..1) */
  score?: number;
  excerpt?: string;
}

export type ChatErrorKind =
  | 'provider_failure'
  | 'runtime_failure'
  | 'tool_failure'
  | 'sources_failure'
  | 'no_sources_found'
  | 'forbidden';

export interface ChatError {
  kind: ChatErrorKind;
  message?: string;
}

/**
 * Estrutura conceitual de partes de mensagem (preparação para futuro).
 * NÃO usamos 'reasoning' — para transparência usamos 'status_events' /
 * 'execution_trace' / 'assistant_steps', visuais e seguros.
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'source'; source: MockRagSource }
  | { type: 'tool_call'; toolCall: MockToolCall }
  | { type: 'status'; event: ChatRunState; label?: string };

export interface ChatMessageMetadata {
  model?: string;
  fallbackUsed?: boolean;
  fallbackFromModel?: string;
  latencyMs?: number;
  /** Eventos de execução visíveis ao usuário (resumidos, seguros) */
  status_events?: Array<{ at: string; event: ChatRunState; label?: string }>;
}

export type FeedbackReason =
  | 'useful'
  | 'incomplete'
  | 'wrong_source'
  | 'wrong_tool'
  | 'confusing'
  | 'other';

export interface MessageFeedback {
  type: 'positive' | 'negative';
  reasons?: FeedbackReason[];
  comment?: string;
  at: string;
}
