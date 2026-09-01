import { describe, expect, it } from 'vitest';
import type { McpBinding, McpTool } from '@/types';
import {
  buildAssistantMcpBindingPayload,
  canUseMcpBindingInSandbox,
  isRemoteMaterializedMcpTool,
} from './assistantMcpGovernance';

const tool = {
  id: 'tool-1',
  serverId: 'server-1',
  mcpServerId: 'server-1',
  name: 'corporate.status.read',
  description: '',
  riskLevel: 'low',
  requiresApproval: true,
  isEnabled: false,
  executionCount: 0,
  metadata: {
    source: 'remote_catalog_materialization',
    remoteCatalog: true,
  },
} as McpTool;

describe('assistant MCP governed binding', () => {
  it('recognizes remote materialized tools', () => {
    expect(isRemoteMaterializedMcpTool(tool)).toBe(true);
  });

  it('builds a closed binding for remote materialized tools', () => {
    expect(buildAssistantMcpBindingPayload(tool)).toEqual({
      mcpServerId: 'server-1',
      mcpToolId: 'tool-1',
      isEnabled: false,
      mode: 'disabled',
      requiresApprovalOverride: true,
    });
  });

  it('does not expose a disabled governed binding to sandbox', () => {
    const binding = {
      id: 'binding-1',
      serverId: 'server-1',
      mcpServerId: 'server-1',
      mcpToolId: 'tool-1',
      assistantId: 'assistant-1',
      assistantName: 'Assistant',
      toolsEnabled: ['corporate.status.read'],
      resourcesEnabled: [],
      createdAt: '',
      approvalPolicy: 'manual',
      isEnabled: false,
      mode: 'disabled',
      tool,
    } as McpBinding;

    expect(canUseMcpBindingInSandbox(binding)).toBe(false);
  });
});
