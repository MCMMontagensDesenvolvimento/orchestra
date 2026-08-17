import type { AuditEventType, AuditLog, RiskLevel } from '@/types';
import { env } from '@/lib/env';
import { displayResourceLabel } from '@/lib/display-safety';
import { mockAuditLogs } from '@/services/mocks';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type PaginatedApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

interface ApiAuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  requestId: string | null;
}

const eventMap: Record<string, AuditEventType> = {
  dev_login: 'user_login',
  logout: 'user_login',
  permission_denied: 'permission_denied',

  assistant_created: 'assistant_created',
  assistant_updated: 'assistant_updated',
  assistant_archived: 'assistant_archived',
  assistant_restored: 'assistant_restored',
  assistant_published: 'assistant_published',
  assistant_unpublished: 'assistant_unpublished',
  assistant_rollback: 'assistant_rollback',
  assistant_version_created: 'assistant_updated',
  assistant_feedback_created: 'assistant_feedback_created',
  assistant_test_result_created: 'assistant_test_result_created',
  assistant_approval_requested: 'assistant_approval_requested',
  assistant_approval_approved: 'assistant_approval_approved',
  assistant_approval_rejected: 'assistant_approval_rejected',
  assistant_approval_cancelled: 'assistant_approval_cancelled',
  assistant_execution_policy_updated: 'assistant_execution_policy_updated',
  assistant_sandbox_policy_updated: 'assistant_sandbox_policy_updated',
  assistant_execution_blocked: 'assistant_execution_blocked',
  assistant_publish_blocked_by_approval: 'assistant_publish_blocked_by_approval',

  agent_run_requested: 'agent_run_requested',
  agent_run_precheck_passed: 'agent_run_precheck_passed',
  agent_run_blocked: 'agent_run_blocked',
  agent_run_started: 'agent_run_started',
  agent_run_completed: 'agent_run_completed',
  agent_run_failed: 'agent_run_failed',
  agent_run_cancelled: 'agent_run_cancelled',

  runtime_health_checked: 'runtime_health_checked',
  runtime_adapter_resolved: 'runtime_adapter_resolved',
  runtime_execution_started: 'runtime_execution_started',
  runtime_execution_completed: 'runtime_execution_completed',
  runtime_execution_failed: 'runtime_execution_failed',
  runtime_execution_blocked: 'runtime_execution_blocked',
  runtime_adapter_misconfigured: 'runtime_adapter_misconfigured',
  agno_adapter_readiness_checked: 'agno_adapter_readiness_checked',

  assistant_share_created: 'policy_changed',
  assistant_share_removed: 'policy_changed',
  role_permission_added: 'policy_changed',
  role_permission_removed: 'policy_changed',
  knowledge_policy_updated: 'policy_changed',
  mcp_policy_updated: 'policy_changed',
};

const auditActionLabels: Record<string, string> = {
  dev_login: 'Login realizado',
  logout: 'Logout realizado',
  permission_denied: 'Permissão negada',

  llm_providers_listed: 'Catálogo LLM consultado',
  llm_provider_read: 'Provedor LLM consultado',
  llm_provider_health_checked: 'Saúde do provedor LLM verificada',
  llm_provider_capabilities_read: 'Capacidades do provedor LLM consultadas',

  'mcp.server.viewed': 'Servidor MCP consultado',
  'mcp.tool.catalog.viewed': 'Catálogo de ferramentas MCP consultado',
  'mcp.precheck.demo_checked': 'Pré-checagem MCP verificada',
  mcp_remote_readonly_discovery_checked: 'Descoberta MCP somente leitura verificada',
  'mcp.precheck.blocked': 'Pré-checagem MCP bloqueada',
  'mcp.tool.execute': 'Execução de ferramenta MCP solicitada',

  rag_readiness_checked: 'Prontidão do RAG verificada',
  rag_local_search_executed: 'Busca local RAG executada',
  rag_semantic_search_requested: 'Busca semântica RAG solicitada',
  rag_semantic_search_fallback: 'Fallback da busca semântica RAG aplicado',
  rag_semantic_search_completed: 'Busca semântica RAG concluída',
  rag_query_requested: 'Consulta RAG solicitada',
  rag_query_blocked: 'Consulta RAG bloqueada',
  rag_query_failed: 'Consulta RAG falhou',

  runtime_health_checked: 'Saúde do runtime verificada',
  agno_adapter_readiness_checked: 'Prontidão do Agno verificada',
  runtime_adapter_resolved: 'Adaptador de runtime resolvido',
  runtime_execution_started: 'Execução do runtime iniciada',
  runtime_execution_completed: 'Execução do runtime concluída',
  runtime_execution_failed: 'Execução do runtime falhou',
  runtime_execution_blocked: 'Execução do runtime bloqueada',

  assistant_created: 'Assistente criado',
  assistant_updated: 'Assistente atualizado',
  assistant_archived: 'Assistente arquivado',
  assistant_restored: 'Assistente restaurado',
  assistant_published: 'Assistente publicado',
  assistant_unpublished: 'Publicação do assistente removida',
  assistant_rollback: 'Reversão do assistente executada',
  assistant_version_created: 'Versão do assistente criada',
  assistant_approval_requested: 'Aprovação do assistente solicitada',
  assistant_approval_approved: 'Aprovação do assistente concedida',
  assistant_approval_rejected: 'Aprovação do assistente rejeitada',
  assistant_approval_cancelled: 'Aprovação do assistente cancelada',

  knowledge_base_created: 'Base de conhecimento criada',
  knowledge_base_updated: 'Base de conhecimento atualizada',
  knowledge_base_archived: 'Base de conhecimento arquivada',
  knowledge_base_restored: 'Base de conhecimento restaurada',
  knowledge_document_created: 'Documento de conhecimento criado',
  knowledge_document_uploaded: 'Documento de conhecimento enviado',
  knowledge_document_updated: 'Documento de conhecimento atualizado',
  knowledge_document_archived: 'Documento de conhecimento arquivado',
  knowledge_ingestion_requested: 'Ingestão de conhecimento solicitada',
  knowledge_ingestion_started: 'Ingestão de conhecimento iniciada',
  knowledge_ingestion_completed: 'Ingestão de conhecimento concluída',
  knowledge_ingestion_failed: 'Ingestão de conhecimento falhou',

  workspace_created: 'Workspace criado',
  workspace_updated: 'Workspace atualizado',
  user_created: 'Usuário criado',
  user_updated: 'Usuário atualizado',
  role_created: 'Perfil criado',
  role_updated: 'Perfil atualizado',
  role_permission_added: 'Permissão adicionada ao perfil',
  role_permission_removed: 'Permissão removida do perfil',
};

function humanizeAuditAction(action: string) {
  const mapped = auditActionLabels[action];
  if (mapped) return mapped;

  const normalized = action
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Evento de auditoria';

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function auditActionLabel(action?: string | null) {
  if (!action) return 'Evento de auditoria';
  return humanizeAuditAction(action);
}

const riskForAction = (action: string): RiskLevel => {
  if (action.includes('permission') || action.includes('published')) return 'high';
  if (action.includes('login') || action.includes('logout')) return 'low';
  return 'medium';
};

const mapAuditLog = (log: ApiAuditLog): AuditLog => ({
  id: log.id,
  event: eventMap[log.action] ?? 'policy_changed',
  action: log.action,
  description: auditActionLabel(log.action),
  user:
    log.actor?.name
    ?? log.actor?.email
    ?? (log.actorUserId ? 'Usuário não disponível' : 'Sistema'),
  timestamp: log.createdAt,
  resource: displayResourceLabel(log.entity, log.entityId),
  riskLevel: riskForAction(log.action),
});

export const auditService = {
  async logs(): Promise<AuditLog[]> {
    if (env.useMocks) return mockResponse(mockAuditLogs);
    const response = await apiClient.get<PaginatedApiEnvelope<ApiAuditLog>>(endpoints.audit.logs);
    return response.data.data.map(mapAuditLog);
  },
};
