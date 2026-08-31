import { describe, expect, it } from 'vitest';
import { mapMcpServer } from '../../src/modules/mcp/mcp.mapper';
import {
  mcpExecutionRequestSchema,
  mcpRemoteCatalogMaterializeSchema,
  mcpServerCreateSchema,
} from '../../src/modules/mcp/mcp.schema';

describe('MCP public request and response secret boundary', () => {
  it('accepts a logical secret reference without accepting raw credential fields', () => {
    expect(mcpServerCreateSchema.parse({
      name: 'Read-only MCP',
      baseUrl: 'https://mcp.example.test/v1',
      authType: 'bearer',
      secretRef: 'vault://orchestra/mcp/read-only',
    })).toMatchObject({ secretRef: 'vault://orchestra/mcp/read-only' });

    expect(mcpServerCreateSchema.safeParse({
      name: 'Unsafe MCP',
      baseUrl: 'https://mcp.example.test',
      apiKey: 'raw-key-fixture',
    }).success).toBe(false);
    expect(mcpServerCreateSchema.safeParse({
      name: 'Unsafe MCP',
      baseUrl: 'https://user:password@mcp.example.test',
    }).success).toBe(false);
    expect(mcpServerCreateSchema.safeParse({
      name: 'Unsafe MCP',
      baseUrl: 'https://mcp.example.test?token=raw-token-fixture',
    }).success).toBe(false);
    expect(mcpServerCreateSchema.safeParse({
      name: 'Unsafe MCP',
      metadata: { authorization: 'Bearer raw-token-fixture' },
    }).success).toBe(false);
  });

  it('rejects direct credential fields in execution requests and arguments', () => {
    expect(mcpExecutionRequestSchema.safeParse({
      mcpToolId: '00000000-0000-0000-0000-000000000501',
      mode: 'sandbox',
      authorization: 'Bearer raw-token-fixture',
      input: { query: 'safe' },
    }).success).toBe(false);
    expect(mcpExecutionRequestSchema.safeParse({
      mcpToolId: '00000000-0000-0000-0000-000000000501',
      mode: 'sandbox',
      input: { apiKey: 'raw-key-fixture' },
    }).success).toBe(false);
  });

  it('keeps remote catalog materialization free of client-controlled execution authority', () => {
    expect(
      mcpRemoteCatalogMaterializeSchema.parse(undefined),
    ).toEqual({});

    expect(
      mcpRemoteCatalogMaterializeSchema.parse({}),
    ).toEqual({});

    const forbiddenBodies = [
      { isEnabled: true },
      { requiresApproval: false },
      { allowRuntimeExecution: true },
      { sandboxOnly: false },
      { blockedByDefault: false },
      { runtimeEnabled: true },
      { remoteExecutionEnabled: true },
    ];

    for (const body of forbiddenBodies) {
      expect(
        mcpRemoteCatalogMaterializeSchema.safeParse(body).success,
      ).toBe(false);
    }
  });

  it('maps only credentialConfigured to the public server DTO', () => {
    const mapped = mapMcpServer({
      id: '00000000-0000-0000-0000-000000000601',
      tenantId: '00000000-0000-0000-0000-000000000010',
      workspaceId: '00000000-0000-0000-0000-000000000020',
      name: 'Read-only MCP',
      description: null,
      serverType: 'remote',
      baseUrl: 'https://mcp.example.test',
      status: 'active',
      trustLevel: 'trusted',
      riskLevel: 'low',
      authType: 'bearer',
      secretRef: 'vault://orchestra/mcp/read-only',
      metadata: null,
      createdById: null,
      createdAt: new Date('2026-07-17T12:00:00.000Z'),
      updatedAt: new Date('2026-07-17T12:00:00.000Z'),
      deletedAt: null,
    });

    expect(mapped.credentialConfigured).toBe(true);
    expect(mapped).not.toHaveProperty('secretRef');
    expect(JSON.stringify(mapped)).not.toContain('vault://orchestra/mcp/read-only');
  });
});
