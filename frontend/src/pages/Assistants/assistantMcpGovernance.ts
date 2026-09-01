import type {
  AssistantMcpBindingPayload,
  McpBinding,
  McpTool,
} from '@/types';

function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function isRemoteMaterializedMcpTool(
  tool: McpTool | undefined,
): boolean {
  if (!tool) return false;

  const metadata = metadataRecord(tool.metadata);

  return (
    metadata?.source === 'remote_catalog_materialization'
    && metadata?.remoteCatalog === true
  );
}

export function buildAssistantMcpBindingPayload(
  tool: McpTool,
): AssistantMcpBindingPayload {
  if (isRemoteMaterializedMcpTool(tool)) {
    return {
      mcpServerId: tool.mcpServerId ?? tool.serverId,
      mcpToolId: tool.id,
      isEnabled: false,
      mode: 'disabled',
      requiresApprovalOverride: true,
    };
  }

  return {
    mcpServerId: tool.mcpServerId ?? tool.serverId,
    mcpToolId: tool.id,
    isEnabled: true,
    mode: 'sandbox_only',
    requiresApprovalOverride: tool.requiresApproval ? true : null,
  };
}

export function canUseMcpBindingInSandbox(
  binding: McpBinding | undefined,
): boolean {
  return Boolean(
    binding
      && binding.isEnabled === true
      && binding.mode !== 'disabled'
      && binding.tool?.isEnabled !== false
  );
}
