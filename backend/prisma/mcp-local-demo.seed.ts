import type { Prisma, PrismaClient } from '@prisma/client';
import {
  MCP_LOCAL_DEMO_POLICY,
  MCP_LOCAL_DEMO_SEEDED_AUDIT_ID,
  MCP_LOCAL_DEMO_SERVER,
  MCP_LOCAL_DEMO_SERVER_ID,
  MCP_LOCAL_DEMO_TOOLS,
} from '../src/modules/mcp/local-demo/mcp-local-demo.catalog';

interface McpLocalDemoSeedScope {
  tenantId: string;
  workspaceId: string;
  adminUserId: string;
  assistantId: string;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function seedMcpLocalDemo(prisma: PrismaClient, scope: McpLocalDemoSeedScope) {
  return prisma.$transaction(async (tx) => {
    await tx.mcpServer.upsert({
      where: { id: MCP_LOCAL_DEMO_SERVER_ID },
      update: {
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        name: MCP_LOCAL_DEMO_SERVER.name,
        description: MCP_LOCAL_DEMO_SERVER.description,
        serverType: MCP_LOCAL_DEMO_SERVER.serverType,
        baseUrl: null,
        status: MCP_LOCAL_DEMO_SERVER.status,
        trustLevel: MCP_LOCAL_DEMO_SERVER.trustLevel,
        riskLevel: MCP_LOCAL_DEMO_SERVER.riskLevel,
        authType: MCP_LOCAL_DEMO_SERVER.authType,
        secretRef: null,
        metadata: json(MCP_LOCAL_DEMO_SERVER.metadata),
        createdById: scope.adminUserId,
        deletedAt: null,
      },
      create: {
        id: MCP_LOCAL_DEMO_SERVER_ID,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        name: MCP_LOCAL_DEMO_SERVER.name,
        description: MCP_LOCAL_DEMO_SERVER.description,
        serverType: MCP_LOCAL_DEMO_SERVER.serverType,
        status: MCP_LOCAL_DEMO_SERVER.status,
        trustLevel: MCP_LOCAL_DEMO_SERVER.trustLevel,
        riskLevel: MCP_LOCAL_DEMO_SERVER.riskLevel,
        authType: MCP_LOCAL_DEMO_SERVER.authType,
        metadata: json(MCP_LOCAL_DEMO_SERVER.metadata),
        createdById: scope.adminUserId,
      },
    });

    await tx.mcpToolPolicy.upsert({
      where: { id: '00000000-0000-4000-8000-0000000028d0' },
      update: {
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
        mcpToolId: null,
        allowRuntimeExecution: false,
        sandboxOnly: true,
        requiresApproval: true,
        blockedByDefault: true,
        metadata: json({ phase: '18D', localDemo: true, readOnly: true }),
      },
      create: {
        id: '00000000-0000-4000-8000-0000000028d0',
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
        allowRuntimeExecution: false,
        sandboxOnly: true,
        requiresApproval: true,
        blockedByDefault: true,
        metadata: json({ phase: '18D', localDemo: true, readOnly: true }),
      },
    });

    for (const tool of MCP_LOCAL_DEMO_TOOLS) {
      const metadata = json({
        phase: '18D',
        localDemo: true,
        demo: true,
        localStub: true,
        deterministic: true,
        writeOperation: false,
        ...MCP_LOCAL_DEMO_POLICY,
      });

      await tx.mcpTool.upsert({
        where: { id: tool.id },
        update: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
          name: tool.name,
          description: tool.description,
          inputSchema: json(tool.inputSchema),
          outputSchema: json(tool.outputSchema),
          riskLevel: 'low',
          requiresApproval: true,
          isEnabled: true,
          metadata,
          deletedAt: null,
        },
        create: {
          id: tool.id,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
          name: tool.name,
          description: tool.description,
          inputSchema: json(tool.inputSchema),
          outputSchema: json(tool.outputSchema),
          riskLevel: 'low',
          requiresApproval: true,
          isEnabled: true,
          metadata,
        },
      });

      await tx.mcpToolPolicy.upsert({
        where: { id: tool.policyId },
        update: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
          mcpToolId: tool.id,
          allowRuntimeExecution: false,
          sandboxOnly: true,
          requiresApproval: true,
          blockedByDefault: true,
          metadata,
        },
        create: {
          id: tool.policyId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
          mcpToolId: tool.id,
          allowRuntimeExecution: false,
          sandboxOnly: true,
          requiresApproval: true,
          blockedByDefault: true,
          metadata,
        },
      });

      await tx.assistantMcpBinding.upsert({
        where: { id: tool.bindingId },
        update: {
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          assistantId: scope.assistantId,
          mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
          mcpToolId: tool.id,
          isEnabled: true,
          mode: 'sandbox_only',
          requiresApprovalOverride: true,
          createdById: scope.adminUserId,
        },
        create: {
          id: tool.bindingId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          assistantId: scope.assistantId,
          mcpServerId: MCP_LOCAL_DEMO_SERVER_ID,
          mcpToolId: tool.id,
          isEnabled: true,
          mode: 'sandbox_only',
          requiresApprovalOverride: true,
          createdById: scope.adminUserId,
        },
      });
    }

    await tx.auditLog.upsert({
      where: { id: MCP_LOCAL_DEMO_SEEDED_AUDIT_ID },
      update: {
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        actorUserId: scope.adminUserId,
        action: 'mcp.demo.seeded',
        entity: 'mcp_server',
        entityId: MCP_LOCAL_DEMO_SERVER_ID,
        metadata: json({
          phase: '18D',
          toolCount: MCP_LOCAL_DEMO_TOOLS.length,
          bindingCount: MCP_LOCAL_DEMO_TOOLS.length,
          readOnly: true,
          sandboxOnly: true,
          remoteExecution: false,
          externalNetworkAllowed: false,
          writeToolsAllowed: false,
        }),
        requestId: 'seed-mcp-local-demo-18d',
      },
      create: {
        id: MCP_LOCAL_DEMO_SEEDED_AUDIT_ID,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        actorUserId: scope.adminUserId,
        action: 'mcp.demo.seeded',
        entity: 'mcp_server',
        entityId: MCP_LOCAL_DEMO_SERVER_ID,
        metadata: json({
          phase: '18D',
          toolCount: MCP_LOCAL_DEMO_TOOLS.length,
          bindingCount: MCP_LOCAL_DEMO_TOOLS.length,
          readOnly: true,
          sandboxOnly: true,
          remoteExecution: false,
          externalNetworkAllowed: false,
          writeToolsAllowed: false,
        }),
        requestId: 'seed-mcp-local-demo-18d',
      },
    });

    return {
      serverId: MCP_LOCAL_DEMO_SERVER_ID,
      toolCount: MCP_LOCAL_DEMO_TOOLS.length,
      bindingCount: MCP_LOCAL_DEMO_TOOLS.length,
      remoteExecution: false,
    };
  });
}
