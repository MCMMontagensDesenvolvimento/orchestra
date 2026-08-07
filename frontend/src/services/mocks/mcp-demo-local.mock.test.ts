import { describe, expect, it } from 'vitest';
import {
  mockMcpBindings,
  mockMcpServers,
  mockMcpTools,
  mockToolExecutionLogs,
} from './mcp-demo-local.mock';

describe('MCP demo local 18D frontend catalog', () => {
  it('renders one local server with the three governed tools and bindings', () => {
    expect(mockMcpServers).toHaveLength(1);
    expect(mockMcpTools.map((tool) => tool.name)).toEqual([
      'corporate.status.read',
      'corporate.policy.lookup',
      'corporate.document.search.placeholder',
    ]);
    expect(mockMcpBindings).toHaveLength(3);
  });

  it('keeps every tool read-only, approval-gated and execution-free', () => {
    expect(mockMcpTools.every((tool) => tool.requiresApproval && tool.isEnabled)).toBe(true);
    expect(mockMcpTools.every((tool) => (
      typeof tool.metadata === 'object'
      && tool.metadata !== null
      && (tool.metadata as Record<string, unknown>).readOnly === true
      && (tool.metadata as Record<string, unknown>).remoteExecution === false
      && (tool.metadata as Record<string, unknown>).writeToolsAllowed === false
      && (tool.metadata as Record<string, unknown>).writeOperation === false
      && (tool.metadata as Record<string, unknown>).externalNetworkAllowed === false
      && (tool.metadata as Record<string, unknown>).allowRuntimeExecution === false
    ))).toBe(true);
    expect(mockToolExecutionLogs).toEqual([]);
  });
});
