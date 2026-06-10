export const endpoints = {
  auth: {
    devLogin: '/auth/dev-login',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  tenants: {
    list: '/tenants',
    detail: (id: string) => `/tenants/${id}`,
  },
  workspaces: {
    list: '/workspaces',
    detail: (id: string) => `/workspaces/${id}`,
  },
  users: {
    list: '/users',
    detail: (id: string) => `/users/${id}`,
  },
  roles: {
    list: '/roles',
    detail: (id: string) => `/roles/${id}`,
    permission: (id: string, permissionId: string) => `/roles/${id}/permissions/${permissionId}`,
  },
  permissions: {
    list: '/permissions',
    detail: (id: string) => `/permissions/${id}`,
  },
  assistants: {
    list: '/assistants',
    detail: (id: string) => `/assistants/${id}`,
    archive: (id: string) => `/assistants/${id}/archive`,
    restore: (id: string) => `/assistants/${id}/restore`,
    versions: (id: string) => `/assistants/${id}/versions`,
    version: (id: string, versionId: string) => `/assistants/${id}/versions/${versionId}`,
    publish: (id: string) => `/assistants/${id}/publish`,
    unpublish: (id: string) => `/assistants/${id}/unpublish`,
    rollback: (id: string) => `/assistants/${id}/rollback`,
    publications: (id: string) => `/assistants/${id}/publications`,
    activePublication: (id: string) => `/assistants/${id}/publications/active`,
    feedback: (id: string) => `/assistants/${id}/feedback`,
    testResults: (id: string) => `/assistants/${id}/test-results`,
    shares: (id: string) => `/assistants/${id}/shares`,
    share: (id: string, shareId: string) => `/assistants/${id}/shares/${shareId}`,
  },
  audit: {
    logs: '/audit-logs',
  },
  settings: {
    list: '/settings',
  },
  dashboard: {
    summary: '/dashboard/summary',
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
} as const;
