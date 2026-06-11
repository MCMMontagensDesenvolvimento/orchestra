export type AssistantStatus = 'draft' | 'testing' | 'pending_approval' | 'published' | 'archived';
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type McpServerStatus = 'active' | 'inactive' | 'error';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackType = 'positive' | 'negative' | 'neutral';
export type AssistantTestStatus = 'passed' | 'failed' | 'needs_review';
export type AssistantApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type AssistantApprovalAction = 'publish' | 'rollback' | 'restore' | 'enable_execution' | 'configure_sandbox';
export type AssistantExecutionMode = 'draft_test' | 'sandbox' | 'published' | 'blocked' | 'archived';
export type AgentRunStatus = 'queued' | 'prechecking' | 'blocked' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AuditEventType = 'assistant_created' | 'assistant_published' | 'assistant_unpublished' | 'assistant_rollback' | 'assistant_updated' | 'assistant_archived' | 'assistant_restored' | 'assistant_feedback_created' | 'assistant_test_result_created' | 'assistant_approval_requested' | 'assistant_approval_approved' | 'assistant_approval_rejected' | 'assistant_approval_cancelled' | 'assistant_execution_policy_updated' | 'assistant_sandbox_policy_updated' | 'assistant_execution_blocked' | 'assistant_publish_blocked_by_approval' | 'agent_run_requested' | 'agent_run_precheck_passed' | 'agent_run_blocked' | 'agent_run_started' | 'agent_run_completed' | 'agent_run_failed' | 'agent_run_cancelled' | 'permission_denied' | 'tool_executed' | 'knowledge_updated' | 'user_login' | 'policy_changed' | 'security_alert' | 'approval_requested' | 'approval_granted';

export interface AssistantPublication {
  id: string;
  assistantId: string;
  assistantVersionId: string;
  status: 'active' | 'inactive';
  publishedById: string;
  publishedAt: string;
  unpublishedById?: string | null;
  unpublishedAt?: string | null;
  rollbackFromPublicationId?: string | null;
  rollbackReason?: string | null;
}

export interface AssistantApprovalRequest {
  id: string;
  assistantId: string;
  assistantVersionId?: string | null;
  publicationId?: string | null;
  requestedById: string;
  decidedById?: string | null;
  action: AssistantApprovalAction;
  status: AssistantApprovalStatus;
  reason?: string | null;
  decisionReason?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
  cancelledAt?: string | null;
}

export interface AssistantExecutionPolicy {
  id: string;
  assistantId: string;
  executionMode: AssistantExecutionMode;
  requiresApprovalToPublish: boolean;
  sandboxEnabled: boolean;
  sandboxRequiresAuth: boolean;
  sandboxAllowedForRoles?: string[] | null;
  sandboxBlocksExternalTools: boolean;
  sandboxBlocksRealProviders: boolean;
  sandboxLogsRequired: boolean;
  sandboxCostLimitPlaceholder?: number | null;
  allowDraftTesting: boolean;
  allowPublishedExecution: boolean;
  isExecutionEnabled: boolean;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantExecutionPrecheckReason {
  code: string;
  message: string;
}

export interface AssistantExecutionPrecheckResult {
  canExecute: boolean;
  mode: AssistantExecutionMode;
  reasons: AssistantExecutionPrecheckReason[];
  requestId: string;
}

export type AgentRunPrecheckSnapshot = AssistantExecutionPrecheckResult;

export interface AgentRunEvent {
  id: string;
  agentRunId: string;
  tenantId?: string;
  workspaceId?: string;
  type: string;
  sequence: number;
  status?: AgentRunStatus | string | null;
  message?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  tenantId: string;
  workspaceId: string;
  assistantId: string;
  assistantVersionId?: string | null;
  assistantPublicationId?: string | null;
  conversationId?: string | null;
  requestedById: string;
  status: AgentRunStatus;
  mode: AssistantExecutionMode;
  source: string;
  inputSummary?: string | null;
  requestId?: string | null;
  traceId: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  blockedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  precheckSnapshot?: AgentRunPrecheckSnapshot | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
  events?: AgentRunEvent[];
}

export interface CreateAgentRunInput {
  mode: AssistantExecutionMode;
  input: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface Assistant {
  id: string;
  name: string;
  description: string;
  area: string;
  owner: string;
  status: AssistantStatus;
  model: string;
  fallbackModel: string;
  temperature: number;
  version: string;
  conversations: number;
  costThisMonth: number;
  satisfaction: number;
  createdAt: string;
  updatedAt: string;
  knowledgeBases: string[];
  mcpTools: string[];
  persona?: string;
  tone?: string;
  humor?: string;
  objective?: string;
  tasks?: string;
  prohibitedTasks?: string;
  formality?: string;
  rules?: string;
  restrictions?: string;
  criticalInstructions?: string;
  responseFormat?: string;
  positiveExamples?: string;
  negativeExamples?: string;
  limits?: string;
  escalationPolicy?: string;
  environment?: string;
  activePublication?: AssistantPublication | null;
  executionPolicy?: AssistantExecutionPolicy;
}

export interface AssistantVersion {
  id: string;
  assistantId: string;
  version: string;
  changelog: string;
  author: string;
  createdAt: string;
  status: AssistantStatus;
  description?: string | null;
  instructions?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
}

export interface AssistantFeedback {
  id: string;
  assistantId: string;
  assistantVersionId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  type: FeedbackType;
  rating?: FeedbackType;
  comment?: string;
  user: string;
  timestamp: string;
}

export interface AssistantTestResult {
  id: string;
  assistantId: string;
  assistantVersionId?: string;
  prompt: string;
  response: string;
  model: string;
  latency: number;
  tokensUsed: number;
  sourcesUsed: string[];
  toolsUsed: string[];
  timestamp: string;
  passed: boolean;
  input?: string;
  expectedBehavior?: string | null;
  actualOutput?: string;
  status?: AssistantTestStatus;
  score?: number | null;
  notes?: string | null;
}

export type DataClassification = 'Público' | 'Interno' | 'Confidencial' | 'Restrito';
export type RetentionPeriod = '6 meses' | '1 ano' | '2 anos' | '5 anos' | 'Indefinido';
export type ConnectorType = 'upload' | 'sharepoint' | 'confluence' | 'google_drive' | 's3' | 'api';

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  totalChunks: number;
  status: IngestionStatus;
  lastUpdated: string;
  size: string;
  assistants: string[];
  classification: DataClassification;
  connectorType: ConnectorType;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  retention: RetentionPeriod;
  owner: string;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  type: string;
  size: string;
  status: IngestionStatus;
  chunks: number;
  version: string;
  uploadedBy: string;
  uploadedAt: string;
  lastProcessed: string;
}

export interface McpServer {
  id: string;
  name: string;
  description: string;
  status: McpServerStatus;
  authType: string;
  riskLevel: RiskLevel;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  bindings: number;
  lastSync: string;
  url: string;
  owner: string;
  createdAt: string;
  version: string;
}

export interface McpTool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  executionCount: number;
  inputSchema?: string;
  lastExecuted?: string;
}

export interface McpResource {
  id: string;
  serverId: string;
  name: string;
  uri: string;
  description: string;
  mimeType: string;
}

export interface McpPrompt {
  id: string;
  serverId: string;
  name: string;
  description: string;
  arguments: string[];
}

export interface McpBinding {
  id: string;
  serverId: string;
  assistantId: string;
  assistantName: string;
  toolsEnabled: string[];
  resourcesEnabled: string[];
  createdAt: string;
  approvalPolicy: 'none' | 'manual' | 'auto';
}

export interface ToolExecutionLog {
  id: string;
  serverId: string;
  toolId: string;
  toolName: string;
  assistantName: string;
  user: string;
  status: 'success' | 'error' | 'pending_approval' | 'rejected';
  duration: number;
  timestamp: string;
  input?: string;
  output?: string;
}

export interface Conversation {
  id: string;
  assistantId: string;
  assistantName: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  sources?: string[];
  toolsUsed?: string[];
  feedback?: FeedbackType;
}

export interface AuditLog {
  id: string;
  event: AuditEventType;
  description: string;
  user: string;
  timestamp: string;
  resource: string;
  riskLevel: RiskLevel;
}

export interface KpiData {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  lastLogin: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Workspace {
  id: string;
  tenantId?: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: string;
  key: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  tenantId?: string;
  name: string;
  description?: string | null;
  permissions: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CurrentSession {
  user: {
    id: string;
    name: string;
    email: string;
  };
  tenant: Tenant;
  workspaces: Workspace[];
  roles: string[];
  permissions: string[];
}

export interface AnalyticsData {
  date: string;
  conversations: number;
  cost: number;
  toolCalls: number;
  latency: number;
}

export interface AssistantWizardFormData {
  name: string;
  area: string;
  description: string;
  objective: string;
  tasks: string;
  prohibitedTasks: string;
  persona: string;
  tone: string;
  humor: string;
  formality: string;
  rules: string;
  restrictions: string;
  criticalInstructions: string;
  model: string;
  fallbackModel: string;
  temperature: string;
  responseFormat: string;
  positiveExamples: string;
  negativeExamples: string;
  limits: string;
  escalationPolicy: string;
  knowledgeBases: string[];
  mcpTools: string[];
  approvalActions: string;
  environment: string;
}
