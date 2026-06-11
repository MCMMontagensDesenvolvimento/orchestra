/**
 * Chaves centrais de cache TanStack Query.
 * Evita strings soltas espalhadas e facilita invalidação por domínio.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  dashboard: {
    summary: ['dashboard', 'summary'] as const,
  },
  assistants: {
    all: ['assistants'] as const,
    list: () => [...queryKeys.assistants.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.assistants.all, 'detail', id] as const,
    versions: (id: string) => [...queryKeys.assistants.all, 'versions', id] as const,
    publications: (id: string) => [...queryKeys.assistants.all, 'publications', id] as const,
    activePublication: (id: string) => [...queryKeys.assistants.all, 'active-publication', id] as const,
    approvals: (id: string) => [...queryKeys.assistants.all, 'approvals', id] as const,
    executionPolicy: (id: string) => [...queryKeys.assistants.all, 'execution-policy', id] as const,
    feedback: (id: string) => [...queryKeys.assistants.all, 'feedback', id] as const,
    tests: (id: string) => [...queryKeys.assistants.all, 'tests', id] as const,
  },
  agentRuns: {
    all: ['agent-runs'] as const,
    list: () => [...queryKeys.agentRuns.all, 'list'] as const,
    assistant: (assistantId: string) => [...queryKeys.agentRuns.all, 'assistant', assistantId] as const,
    detail: (runId: string) => [...queryKeys.agentRuns.all, 'detail', runId] as const,
    events: (runId: string) => [...queryKeys.agentRuns.all, 'events', runId] as const,
  },
  knowledge: {
    all: ['knowledge'] as const,
    list: () => [...queryKeys.knowledge.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.knowledge.all, 'detail', id] as const,
    documents: (id?: string) => [...queryKeys.knowledge.all, 'documents', id ?? 'all'] as const,
  },
  mcp: {
    all: ['mcp'] as const,
    servers: () => [...queryKeys.mcp.all, 'servers'] as const,
    server: (id: string) => [...queryKeys.mcp.all, 'server', id] as const,
    tools: (serverId?: string) => [...queryKeys.mcp.all, 'tools', serverId ?? 'all'] as const,
    resources: (serverId?: string) => [...queryKeys.mcp.all, 'resources', serverId ?? 'all'] as const,
    prompts: (serverId?: string) => [...queryKeys.mcp.all, 'prompts', serverId ?? 'all'] as const,
    bindings: () => [...queryKeys.mcp.all, 'bindings'] as const,
    executions: () => [...queryKeys.mcp.all, 'executions'] as const,
  },
  chat: {
    conversations: (assistantId?: string) => ['chat', 'conversations', assistantId ?? 'all'] as const,
    messages: (conversationId: string) => ['chat', 'messages', conversationId] as const,
  },
  analytics: {
    overview: ['analytics', 'overview'] as const,
  },
  audit: {
    logs: ['audit', 'logs'] as const,
  },
  admin: {
    users: ['admin', 'users'] as const,
    workspaces: ['admin', 'workspaces'] as const,
    roles: ['admin', 'roles'] as const,
    permissions: ['admin', 'permissions'] as const,
    settings: ['admin', 'settings'] as const,
  },
} as const;
