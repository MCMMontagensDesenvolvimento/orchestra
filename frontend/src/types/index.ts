export type AssistantStatus = 'draft' | 'published' | 'archived';
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type McpServerStatus = 'active' | 'inactive' | 'error';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackType = 'positive' | 'negative';
export type AuditEventType = 'assistant_created' | 'assistant_published' | 'assistant_updated' | 'tool_executed' | 'knowledge_updated' | 'user_login' | 'policy_changed' | 'security_alert' | 'approval_requested' | 'approval_granted';

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
}

export interface AssistantVersion {
  id: string;
  assistantId: string;
  version: string;
  changelog: string;
  author: string;
  createdAt: string;
  status: AssistantStatus;
}

export interface AssistantFeedback {
  id: string;
  assistantId: string;
  conversationId: string;
  type: FeedbackType;
  comment?: string;
  user: string;
  timestamp: string;
}

export interface AssistantTestResult {
  id: string;
  assistantId: string;
  prompt: string;
  response: string;
  model: string;
  latency: number;
  tokensUsed: number;
  sourcesUsed: string[];
  toolsUsed: string[];
  timestamp: string;
  passed: boolean;
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
