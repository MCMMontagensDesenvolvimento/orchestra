/**
 * Catálogo central de endpoints da API futura.
 * Strings aqui ainda não chamam nada real — servem como contrato para os
 * services no momento da troca de mocks por HTTP real.
 */
export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  dashboard: {
    summary: '/dashboard/summary',
  },
  assistants: {
    list: '/assistants',
    detail: (id: string) => `/assistants/${id}`,
    versions: (id: string) => `/assistants/${id}/versions`,
    feedback: (id: string) => `/assistants/${id}/feedback`,
    test: (id: string) => `/assistants/${id}/test`,
    publish: (id: string) => `/assistants/${id}/publish`,
  },
  knowledge: {
    list: '/knowledge-bases',
    detail: (id: string) => `/knowledge-bases/${id}`,
    documents: (id: string) => `/knowledge-bases/${id}/documents`,
  },
  mcp: {
    servers: '/mcp/servers',
    server: (id: string) => `/mcp/servers/${id}`,
    tools: '/mcp/tools',
    resources: '/mcp/resources',
    prompts: '/mcp/prompts',
    bindings: '/mcp/bindings',
    executions: '/mcp/executions',
  },
  chat: {
    conversations: '/chat/conversations',
    messages: (conversationId: string) => `/chat/conversations/${conversationId}/messages`,
    send: (conversationId: string) => `/chat/conversations/${conversationId}/messages`,
  },
  analytics: {
    overview: '/analytics/overview',
  },
  audit: {
    logs: '/audit/logs',
  },
  admin: {
    users: '/admin/users',
    roles: '/admin/roles',
    workspaces: '/admin/workspaces',
  },
} as const;
