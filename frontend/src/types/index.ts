export type AssistantStatus = 'draft' | 'testing' | 'pending_approval' | 'published' | 'archived';
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'active' | 'archived' | 'disabled' | 'queued' | 'running' | 'completed_placeholder' | 'indexed_placeholder' | 'cancelled';
export type McpServerStatus = 'active' | 'inactive' | 'disabled' | 'archived' | 'error';
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
  tenantId?: string;
  workspaceId?: string;
  name: string;
  description: string;
  documentCount: number;
  totalChunks: number;
  chunkCount?: number;
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
  updatedAt?: string;
  deletedAt?: string | null;
  visibility?: 'private' | 'workspace' | 'tenant';
  dataClassification?: 'public' | 'internal' | 'sensitive' | 'pii' | 'confidential';
  bindingCount?: number;
  dataSourceCount?: number;
  ingestionJobCount?: number;
  policy?: KnowledgePolicy | null;
  metadata?: unknown;
}

export interface KnowledgeDocument {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId: string;
  name: string;
  title?: string;
  description?: string | null;
  type: string;
  sourceType?: string;
  sourceUri?: string | null;
  mimeType?: string | null;
  size: string;
  status: IngestionStatus;
  ingestionStatus?: IngestionStatus | string;
  ingestionErrorCode?: string | null;
  ingestionErrorMessage?: string | null;
  dataClassification?: string;
  contentText?: string | null;
  contentHash?: string | null;
  ingestedAt?: string | null;
  chunkCount?: number;
  metadata?: unknown;
  chunks: number;
  version: string;
  uploadedBy: string;
  uploadedAt: string;
  lastProcessed: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface KnowledgePolicy {
  id: string;
  knowledgeBaseId: string;
  allowRuntimeRetrieval: boolean;
  allowCitationOnly: boolean;
  requireApprovalForExternal: boolean;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDataSource {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId: string;
  name: string;
  type: string;
  config?: unknown;
  status: 'active' | 'disabled' | 'archived';
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface KnowledgeIngestionJob {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId: string;
  documentId?: string | null;
  status: IngestionStatus | string;
  strategy?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  chunksCreated?: number;
  sourceReferencesCreated?: number;
  metadata?: unknown;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  events?: KnowledgeIngestionEvent[];
}

export interface KnowledgeIngestionEvent {
  id: string;
  jobId: string;
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId: string;
  documentId?: string | null;
  eventType: string;
  level: string;
  message?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenEstimate: number;
  charCount: number;
  status: 'active' | 'stale' | 'archived';
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSourceReference {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkId?: string | null;
  label: string;
  sourceType: string;
  sourceUri?: string | null;
  sectionTitle?: string | null;
  pageNumber?: number | null;
  startOffset?: number | null;
  endOffset?: number | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface RagReadiness {
  assistantId: string;
  ready?: boolean;
  canUseKnowledge: boolean;
  knowledgeBaseCount?: number;
  documentCount?: number;
  chunkCount?: number;
  sourceReferenceCount?: number;
  enabledBindingCount?: number;
  blockedReasons?: string[];
  warnings?: Array<{ code: string; message: string }>;
  knowledgeBasesBound: number;
  documentsIngested: number;
  chunksAvailable: number;
  missingRequirements: string[];
  retrievalMode: 'local_chunks_only';
  embeddingsEnabled: false;
  vectorStoreEnabled: false;
}

export interface RagLocalSearchResult {
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  score: number;
  snippet: string;
  source: {
    label: string;
    sourceUri?: string | null;
    sectionTitle?: string | null;
  } | null;
}

export interface RagLocalSearchResponse {
  mode: 'keyword_local_placeholder';
  retrievalMode: 'local_chunks_only';
  embeddingsEnabled: false;
  vectorStoreEnabled: false;
  results: RagLocalSearchResult[];
}

export type RagQueryStatus = 'completed' | 'no_results' | 'blocked' | 'failed';

export interface RagQueryWarning {
  code: string;
  message: string;
}

export interface RagQuerySource {
  id?: string;
  rank: number;
  score: number;
  knowledgeBaseId: string;
  documentId: string;
  chunkId: string;
  sourceReferenceId?: string | null;
  citationLabel: string;
  documentTitle?: string | null;
  excerpt: string;
  sourceUri?: string | null;
  sourceType?: string | null;
  sectionTitle?: string | null;
  pageNumber?: number | null;
  matchType?: string;
  metadata?: unknown;
  createdAt?: string;
}

export interface RagQueryRecord {
  id: string;
  queryId: string;
  assistantId: string;
  assistantVersionId?: string | null;
  agentRunId?: string | null;
  query: string;
  queryText?: string;
  normalizedQuery?: string;
  mode: 'local_keyword' | 'local_readiness' | 'future_vector' | string;
  status: RagQueryStatus;
  limit: number;
  resultCount: number;
  blockedReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  createdById?: string;
  metadata?: unknown;
  sources?: RagQuerySource[];
  createdAt: string;
}

export interface RagQueryResponse {
  queryId?: string;
  assistantId: string;
  status: RagQueryStatus;
  query?: string;
  code?: string;
  message?: string;
  reasons?: string[];
  readiness?: RagReadiness;
  resultCount: number;
  sources: RagQuerySource[];
  warnings: RagQueryWarning[];
}

export interface AssistantKnowledgeBinding {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  assistantId: string;
  knowledgeBaseId: string;
  isEnabled: boolean;
  retrievalMode: 'disabled' | 'citation_only' | 'retrieval_placeholder';
  priority: number;
  createdById?: string | null;
  knowledgeBase?: KnowledgeBase;
  createdAt: string;
  updatedAt: string;
}

export interface McpServer {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  name: string;
  description: string;
  status: McpServerStatus;
  serverType?: 'internal' | 'external' | 'local' | 'remote';
  trustLevel?: 'trusted' | 'restricted' | 'experimental';
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
  updatedAt?: string;
  deletedAt?: string | null;
  version: string;
  secretRef?: string | null;
  metadata?: unknown;
}

export interface McpTool {
  id: string;
  serverId: string;
  mcpServerId?: string;
  tenantId?: string;
  workspaceId?: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  isEnabled?: boolean;
  executionCount: number;
  inputSchema?: string;
  outputSchema?: string;
  lastExecuted?: string;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  policy?: McpToolPolicy | null;
}

export interface McpToolPolicy {
  id: string;
  mcpServerId: string;
  mcpToolId?: string | null;
  allowRuntimeExecution: boolean;
  sandboxOnly: boolean;
  requiresApproval: boolean;
  blockedByDefault: boolean;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface McpResource {
  id: string;
  serverId: string;
  mcpServerId?: string;
  name: string;
  uri: string;
  description: string;
  mimeType: string;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface McpPrompt {
  id: string;
  serverId: string;
  mcpServerId?: string;
  name: string;
  description: string;
  arguments: string[];
  template?: string | null;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
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
  mcpServerId?: string;
  mcpToolId?: string | null;
  isEnabled?: boolean;
  mode?: 'disabled' | 'sandbox_only' | 'enabled_placeholder';
  requiresApprovalOverride?: boolean | null;
  server?: McpServer;
  tool?: McpTool;
  updatedAt?: string;
}

export interface AssistantMcpBindingPayload {
  mcpServerId: string;
  mcpToolId?: string | null;
  isEnabled?: boolean;
  mode?: 'disabled' | 'sandbox_only' | 'enabled_placeholder';
  requiresApprovalOverride?: boolean | null;
}

export type McpToolCallStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled' | 'approval_required';
export type McpExecutionPrecheckStatus = 'allowed' | 'blocked' | 'approval_required';

export interface McpExecutionPrecheck {
  canExecute: boolean;
  status: McpExecutionPrecheckStatus;
  mode: 'sandbox';
  reasons: string[];
  warnings: Array<{ code: string; message: string }>;
  policy: {
    requiresApproval: boolean;
    riskLevel: RiskLevel;
    bindingMode?: 'disabled' | 'sandbox_only' | 'enabled_placeholder' | string;
    sandboxOnly: boolean;
    allowRuntimeExecution: boolean;
    blockedByDefault: boolean;
    executionMode?: AssistantExecutionMode | string;
  };
}

export interface McpToolCallEvent {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  toolCallId: string;
  agentRunId?: string | null;
  type: string;
  message?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface McpToolCallRecord {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  assistantId: string;
  assistantVersionId?: string | null;
  agentRunId?: string | null;
  mcpServerId: string;
  mcpToolId: string;
  assistantMcpBindingId?: string | null;
  requestedByUserId?: string;
  mode: 'sandbox';
  status: McpToolCallStatus;
  riskLevelSnapshot: RiskLevel;
  approvalRequiredSnapshot: boolean;
  requestId?: string | null;
  traceId?: string | null;
  inputHash?: string | null;
  inputPreview?: string | null;
  outputPreview?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  policySnapshot?: unknown;
  metadata?: unknown;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  createdAt: string;
  updatedAt?: string;
  server?: McpServer;
  tool?: McpTool;
  binding?: McpBinding;
  events?: McpToolCallEvent[];
  reasons?: string[];
}

export interface McpSandboxExecutionPayload {
  mcpToolId: string;
  agentRunId?: string;
  mode?: 'sandbox';
  input?: unknown;
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
