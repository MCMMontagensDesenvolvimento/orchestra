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
}) {
  return {
    id: input.id,
    mode: 'sandbox_only',
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
      policies: [{
        requiresApproval: input.policyRequiresApproval ?? false,
        allowRuntimeExecution: false,
        sandboxOnly: true,
        blockedByDefault: true,
      }],
    },
    server: {
      id: 'server-1',
      name: 'Governed MCP server',
      status: 'active',
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
});
