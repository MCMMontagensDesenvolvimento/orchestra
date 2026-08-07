export const MCP_LOCAL_DEMO_PHASE = '18D';
export const MCP_LOCAL_DEMO_SERVER_ID = '00000000-0000-4000-8000-0000000018d0';
export const MCP_LOCAL_DEMO_SEEDED_AUDIT_ID = '00000000-0000-4000-8000-0000000018da';

export const MCP_LOCAL_DEMO_POLICY = Object.freeze({
  readOnly: true,
  remoteExecution: false,
  writeToolsAllowed: false,
  externalNetworkAllowed: false,
  requiresApproval: true,
  sandboxOnly: true,
  allowRuntimeExecution: false,
  blockedByDefault: true,
  externalProviderAllowed: false,
  realEmbeddingsAllowed: false,
  chatAgentRunAllowed: false,
  executionMode: 'precheck_only',
});

export const MCP_LOCAL_DEMO_SERVER = Object.freeze({
  id: MCP_LOCAL_DEMO_SERVER_ID,
  name: 'MCP Demo Local — Corporate Readonly',
  description: 'Servidor MCP local demonstrativo para validar catálogo, ferramentas e governança sem chamada externa real.',
  serverType: 'local',
  status: 'active',
  trustLevel: 'trusted',
  riskLevel: 'low',
  authType: 'none',
  metadata: {
    phase: MCP_LOCAL_DEMO_PHASE,
    source: 'seed-demo-local-governed',
    localDemo: true,
    demo: true,
    configured: true,
    healthy: true,
    readiness: 'ready',
    localOnly: true,
    version: '18d.1',
    owner: 'Orchestra Local',
    lastSync: '2026-08-06T12:00:00.000Z',
    ...MCP_LOCAL_DEMO_POLICY,
  },
});

export const MCP_LOCAL_DEMO_TOOLS = Object.freeze([
  {
    id: '00000000-0000-4000-8000-0000000018d1',
    policyId: '00000000-0000-4000-8000-0000000028d1',
    bindingId: '00000000-0000-4000-8000-0000000038d1',
    name: 'corporate.status.read',
    description: 'Retorna status corporativo sanitizado e determinístico no catálogo demo local.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scope: { type: 'string', enum: ['summary'] },
      },
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string' },
        source: { type: 'string', const: 'local_demo_stub' },
      },
    },
  },
  {
    id: '00000000-0000-4000-8000-0000000018d2',
    policyId: '00000000-0000-4000-8000-0000000028d2',
    bindingId: '00000000-0000-4000-8000-0000000038d2',
    name: 'corporate.policy.lookup',
    description: 'Consulta política demonstrativa mantida somente no stub local determinístico.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        policyKey: { type: 'string', maxLength: 80 },
      },
      required: ['policyKey'],
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        found: { type: 'boolean' },
        summary: { type: 'string' },
        source: { type: 'string', const: 'local_demo_stub' },
      },
    },
  },
  {
    id: '00000000-0000-4000-8000-0000000018d3',
    policyId: '00000000-0000-4000-8000-0000000028d3',
    bindingId: '00000000-0000-4000-8000-0000000038d3',
    name: 'corporate.document.search.placeholder',
    description: 'Busca placeholder em documentos autorizados, sem RAG ou embeddings reais.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', maxLength: 160 },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        results: { type: 'array', maxItems: 0 },
        placeholder: { type: 'boolean', const: true },
        source: { type: 'string', const: 'local_demo_stub' },
      },
    },
  },
] as const);

export function isMcpLocalDemoMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const value = metadata as Record<string, unknown>;
  return value.localDemo === true && value.phase === MCP_LOCAL_DEMO_PHASE;
}

export function getMcpLocalDemoPrecheck(server: { id: string; serverType: string; metadata: unknown }) {
  const isGovernedDemo = server.id === MCP_LOCAL_DEMO_SERVER_ID
    && server.serverType === 'local'
    && isMcpLocalDemoMetadata(server.metadata);

  if (!isGovernedDemo) return null;

  return {
    serverId: server.id,
    status: 'ready' as const,
    configured: true,
    healthy: true,
    allowed: false,
    failClosed: true,
    mode: 'local_demo_precheck' as const,
    reason: 'Catálogo demo local pronto para homologação visual; execução de tools permanece bloqueada.',
    checks: [
      { name: 'catalog', status: 'pass' as const, message: `${MCP_LOCAL_DEMO_TOOLS.length} tools demo read-only catalogadas.` },
      { name: 'local_only', status: 'pass' as const, message: 'Nenhum transporte MCP remoto é criado.' },
      { name: 'write_tools', status: 'pass' as const, message: 'Tools de escrita não são permitidas.' },
      { name: 'runtime_execution', status: 'pass' as const, message: 'Execução permanece bloqueada; somente precheck determinístico.' },
    ],
    policy: { ...MCP_LOCAL_DEMO_POLICY },
  };
}
