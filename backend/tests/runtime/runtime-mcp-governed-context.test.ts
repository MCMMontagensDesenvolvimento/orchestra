import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRuntimeExecutionContext } from '../../src/modules/runtime/runtime.context';

const mocks = vi.hoisted(() => ({
  getRuntimeContextSummary: vi.fn(),
}));

vi.mock('../../src/modules/agent-runs/agent-runs.repository', () => ({
  agentRunsRepository: {
    getRuntimeContextSummary: mocks.getRuntimeContextSummary,
  },
}));

function runtimeInput() {
  return {
    requestId: 'req-mcp-context-1',
    traceId: 'trace-mcp-context-1',
    runId: 'run-mcp-context-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    assistant: {
      id: 'assistant-1',
      name: 'Governed MCP Assistant',
      description: 'Uses only Orchestra-authorized descriptors.',
      status: 'published',
      versions: [{
        id: 'version-1',
        instructions: 'Use only governed tools.',
        modelProvider: 'openai',
        modelName: 'test-model',
        temperature: 0.2,
      }],
    },
    assistantVersionId: 'version-1',
    assistantPublicationId: 'publication-1',
    executionMode: 'published' as const,
    provider: 'agno_http' as const,
    input: 'Current governed question.',
    executionPolicy: {
      allowExternalLlmProviders: true,
      allowedLlmProviders: ['openai'],
      defaultLlmProvider: 'openai',
    },
    precheckSnapshot: {
      canExecute: true,
      mode: 'published' as const,
      reasons: [],
      requestId: 'req-mcp-context-1',
    },
  };
}

function binding(input: {
  id: string;
  toolId: string;
  name: string;
  riskLevel: string;
  toolRequiresApproval?: boolean;
  policyRequiresApproval?: boolean;
  overrideRequiresApproval?: boolean | null;
  mode?: string;
  remote?: boolean;
  readOnly?: boolean;
  runtimeAllowed?: boolean;
}) {
  return {
    id: input.id,
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    mcpToolId: input.toolId,
    isEnabled: true,
    mode: input.mode ?? 'sandbox_only',
    requiresApprovalOverride: input.overrideRequiresApproval ?? null,
    tool: {
      id: input.toolId,
      name: input.name,
      description: `Governed descriptor ${input.name}.`,
      inputSchema: { type: 'object', properties: {} },
      riskLevel: input.riskLevel,
      requiresApproval: input.toolRequiresApproval ?? false,
      isEnabled: true,
      deletedAt: null,
      metadata: input.readOnly ? { readOnly: true } : null,
      policies: [{
        requiresApproval: input.policyRequiresApproval ?? false,
        allowRuntimeExecution: input.runtimeAllowed ?? false,
        sandboxOnly: !(input.runtimeAllowed ?? false),
        blockedByDefault: !(input.runtimeAllowed ?? false),
      }],
    },
    server: {
      id: 'server-1',
      name: 'Governed MCP server',
      serverType: input.remote ? 'remote' : 'local',
      status: 'active',
      trustLevel: 'trusted',
      riskLevel: 'low',
      deletedAt: null,
    },
  };
}

describe('governed MCP runtime context', () => {
  beforeEach(() => {
    mocks.getRuntimeContextSummary.mockResolvedValue({
      knowledgeBindingsCount: 0,
      chunkCount: 0,
      sourceReferenceCount: 0,
      lastRagQuery: null,
      sourceReferences: [],
      mcpBindings: [
        binding({ id: 'binding-low', toolId: 'tool-low', name: 'safe_lookup', riskLevel: 'low' }),
        binding({ id: 'binding-medium', toolId: 'tool-medium', name: 'medium_risk_lookup', riskLevel: 'medium' }),
        binding({
          id: 'binding-policy-approval',
          toolId: 'tool-policy-approval',
          name: 'policy_approval_lookup',
          riskLevel: 'low',
          policyRequiresApproval: true,
        }),
        binding({ id: 'binding-high', toolId: 'tool-high', name: 'high_risk_lookup', riskLevel: 'high' }),
      ],
      lastToolCallIds: ['old-tool-call-id'],
    });
  });

  it('selects only enabled bound tools that do not require approval or carry high risk', async () => {
    const context = await buildRuntimeExecutionContext(runtimeInput());

    expect(context.mcp.allowedSandboxTools).toEqual([
      expect.objectContaining({
        id: 'binding-low',
        toolId: 'tool-low',
        name: 'safe_lookup',
        riskLevel: 'low',
        requiresApproval: false,
      }),
    ]);
    expect(context.mcp.requiresApproval).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tool-medium', riskLevel: 'medium' }),
      expect.objectContaining({ id: 'tool-policy-approval', riskLevel: 'low' }),
      expect.objectContaining({ id: 'tool-high', riskLevel: 'high' }),
    ]));
    expect(context.mcp.lastToolCallIds).toEqual(['old-tool-call-id']);
  });

  it('lets an explicit binding approval override fail closed over a permissive tool policy', async () => {
    mocks.getRuntimeContextSummary.mockResolvedValueOnce({
      knowledgeBindingsCount: 0,
      chunkCount: 0,
      sourceReferenceCount: 0,
      lastRagQuery: null,
      sourceReferences: [],
      mcpBindings: [binding({
        id: 'binding-override',
        toolId: 'tool-override',
        name: 'override_lookup',
        riskLevel: 'low',
        overrideRequiresApproval: true,
      })],
      lastToolCallIds: [],
    });

    const context = await buildRuntimeExecutionContext(runtimeInput());

    expect(context.mcp.allowedSandboxTools).toEqual([]);
    expect(context.mcp.requiresApproval).toEqual([
      expect.objectContaining({ id: 'tool-override', riskLevel: 'low' }),
    ]);
  });

  it('does not let an explicit false binding override bypass approval required by tool policy', async () => {
    mocks.getRuntimeContextSummary.mockResolvedValueOnce({
      knowledgeBindingsCount: 0,
      chunkCount: 0,
      sourceReferenceCount: 0,
      lastRagQuery: null,
      sourceReferences: [],
      mcpBindings: [binding({
        id: 'binding-policy-override',
        toolId: 'tool-policy-override',
        name: 'policy_override_lookup',
        riskLevel: 'low',
        policyRequiresApproval: true,
        overrideRequiresApproval: false,
      })],
      lastToolCallIds: [],
    });

    const context = await buildRuntimeExecutionContext(runtimeInput());

    expect(context.mcp.allowedSandboxTools).toEqual([]);
    expect(context.mcp.requiresApproval).toEqual([
      expect.objectContaining({ id: 'tool-policy-override', riskLevel: 'low' }),
    ]);
  });

  it('admits a low-risk read-only remote tool only for its valid claimed run grant', async () => {
    mocks.getRuntimeContextSummary.mockResolvedValueOnce({
      knowledgeBindingsCount: 0,
      chunkCount: 0,
      sourceReferenceCount: 0,
      lastRagQuery: null,
      sourceReferences: [],
      mcpBindings: [binding({
        id: 'binding-approved',
        toolId: 'tool-approved',
        name: 'approved_lookup',
        riskLevel: 'low',
        toolRequiresApproval: true,
        policyRequiresApproval: true,
        overrideRequiresApproval: true,
        mode: 'enabled_placeholder',
        remote: true,
        readOnly: true,
        runtimeAllowed: true,
      })],
      lastToolCallIds: [],
    });

    const context = await buildRuntimeExecutionContext({
      ...runtimeInput(),
      mcpExecutionApproval: {
        status: 'claimed',
        tenantId: 'tenant-1',
        workspaceId: 'workspace-1',
        assistantId: 'assistant-1',
        assistantVersionId: 'version-1',
        mcpServerId: 'server-1',
        mcpToolId: 'tool-approved',
        assistantMcpBindingId: 'binding-approved',
        claimedByAgentRunId: 'run-mcp-context-1',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    expect(context.mcp.allowedSandboxTools).toEqual([
      expect.objectContaining({
        id: 'binding-approved',
        toolId: 'tool-approved',
        requiresApproval: true,
        requiresApprovalByPolicy: true,
        approvalSatisfiedForRun: true,
      }),
    ]);
    expect(context.mcp.requiresApproval).toEqual([]);
  });

  it('rejects a claimed grant when its assistant, version, tool, or binding scope differs', async () => {
    const approvedBinding = binding({
      id: 'binding-approved',
      toolId: 'tool-approved',
      name: 'approved_lookup',
      riskLevel: 'low',
      toolRequiresApproval: true,
      mode: 'enabled_placeholder',
      remote: true,
      readOnly: true,
      runtimeAllowed: true,
    });
    const grant = {
      status: 'claimed' as const,
      tenantId: 'tenant-1',
      workspaceId: 'workspace-1',
      assistantId: 'assistant-1',
      assistantVersionId: 'version-1',
      mcpServerId: 'server-1',
      mcpToolId: 'tool-approved',
      assistantMcpBindingId: 'binding-approved',
      claimedByAgentRunId: 'run-mcp-context-1',
      expiresAt: new Date(Date.now() + 60_000),
    };

    for (const mismatch of [
      { assistantId: 'assistant-other' },
      { assistantVersionId: 'version-other' },
      { mcpToolId: 'tool-other' },
      { assistantMcpBindingId: 'binding-other' },
    ]) {
      mocks.getRuntimeContextSummary.mockResolvedValueOnce({
        knowledgeBindingsCount: 0,
        chunkCount: 0,
        sourceReferenceCount: 0,
        lastRagQuery: null,
        sourceReferences: [],
        mcpBindings: [approvedBinding],
        lastToolCallIds: [],
      });

      const context = await buildRuntimeExecutionContext({
        ...runtimeInput(),
        mcpExecutionApproval: { ...grant, ...mismatch },
      });

      expect(context.mcp.allowedSandboxTools).toEqual([]);
      expect(context.mcp.requiresApproval).toEqual([
        expect.objectContaining({ id: 'tool-approved' }),
      ]);
    }
  });

  it('does not admit the same remote grant in sandbox mode', async () => {
    const approvedBinding = binding({
      id: 'binding-approved',
      toolId: 'tool-approved',
      name: 'approved_lookup',
      riskLevel: 'low',
      toolRequiresApproval: true,
      mode: 'enabled_placeholder',
      remote: true,
      readOnly: true,
      runtimeAllowed: true,
    });
    mocks.getRuntimeContextSummary.mockResolvedValueOnce({
      knowledgeBindingsCount: 0,
      chunkCount: 0,
      sourceReferenceCount: 0,
      lastRagQuery: null,
      sourceReferences: [],
      mcpBindings: [approvedBinding],
      lastToolCallIds: [],
    });

    const context = await buildRuntimeExecutionContext({
      ...runtimeInput(),
      executionMode: 'sandbox',
      mcpExecutionApproval: {
        status: 'claimed',
        tenantId: 'tenant-1',
        workspaceId: 'workspace-1',
        assistantId: 'assistant-1',
        assistantVersionId: 'version-1',
        mcpServerId: 'server-1',
        mcpToolId: 'tool-approved',
        assistantMcpBindingId: 'binding-approved',
        claimedByAgentRunId: 'run-mcp-context-1',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    expect(context.mcp.allowedSandboxTools).toEqual([]);
    expect(context.mcp.requiresApproval).toEqual([
      expect.objectContaining({ id: 'tool-approved' }),
    ]);
  });
});
