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
    dataSources: (id?: string) => [...queryKeys.knowledge.all, 'data-sources', id ?? 'all'] as const,
    ingestion: (documentId: string) => [...queryKeys.knowledge.all, 'ingestion', documentId] as const,
    chunks: (documentId: string) => [...queryKeys.knowledge.all, 'chunks', documentId] as const,
    sourceReferences: (documentId: string) => [...queryKeys.knowledge.all, 'source-references', documentId] as const,
    assistantBindings: (assistantId: string) => [...queryKeys.knowledge.all, 'assistant-bindings', assistantId] as const,
    ragReadiness: (assistantId: string) => [...queryKeys.knowledge.all, 'rag-readiness', assistantId] as const,
    ragQueries: (assistantId: string) => [...queryKeys.knowledge.all, 'rag-queries', assistantId] as const,
    ragQuery: (queryId: string) => [...queryKeys.knowledge.all, 'rag-query', queryId] as const,
  },
  mcp: {
    all: ['mcp'] as const,
    servers: () => [...queryKeys.mcp.all, 'servers'] as const,
    server: (id: string) => [...queryKeys.mcp.all, 'server', id] as const,
    tools: (serverId?: string) => [...queryKeys.mcp.all, 'tools', serverId ?? 'all'] as const,
    resources: (serverId?: string) => [...queryKeys.mcp.all, 'resources', serverId ?? 'all'] as const,
    prompts: (serverId?: string) => [...queryKeys.mcp.all, 'prompts', serverId ?? 'all'] as const,
    bindings: () => [...queryKeys.mcp.all, 'bindings'] as const,
    assistantBindings: (assistantId: string) => [...queryKeys.mcp.all, 'assistant-bindings', assistantId] as const,
    executions: () => [...queryKeys.mcp.all, 'executions'] as const,
    assistantToolCalls: (assistantId: string) => [...queryKeys.mcp.all, 'assistant-tool-calls', assistantId] as const,
    toolCall: (toolCallId: string) => [...queryKeys.mcp.all, 'tool-call', toolCallId] as const,
    toolCallEvents: (toolCallId: string) => [...queryKeys.mcp.all, 'tool-call-events', toolCallId] as const,
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
  runtime: {
    all: ['runtime'] as const,
    providers: () => [...queryKeys.runtime.all, 'providers'] as const,
    capabilities: () => [...queryKeys.runtime.all, 'capabilities'] as const,
    health: () => [...queryKeys.runtime.all, 'health'] as const,
    config: () => [...queryKeys.runtime.all, 'config'] as const,
  },
  admin: {
    users: ['admin', 'users'] as const,
    workspaces: ['admin', 'workspaces'] as const,
    roles: ['admin', 'roles'] as const,
    permissions: ['admin', 'permissions'] as const,
    settings: ['admin', 'settings'] as const,
  },
} as const;
