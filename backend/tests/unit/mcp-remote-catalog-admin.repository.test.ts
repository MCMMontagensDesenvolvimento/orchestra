import { describe, expect, it, vi } from 'vitest';
import { McpRemoteCatalogAdminPersistenceRepository } from '../../src/modules/mcp/remote/mcp-remote-catalog-admin.repository';

describe('McpRemoteCatalogAdminPersistenceRepository.listDiscoverySpecs', () => {
  it('queries only non-deleted discovery specs in tenant/workspace/server scope', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        externalName: 'corporate.status.read',
        specHash: 'a'.repeat(64),
      },
    ]);

    const repository = new McpRemoteCatalogAdminPersistenceRepository({
      mcpRemoteCatalogEntry: {
        findMany,
      },
      mcpRemoteCatalogApplyLedger: {},
    } as never);

    const result = await repository.listDiscoverySpecs(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
    );

    expect(findMany).toHaveBeenCalledTimes(1);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: '11111111-1111-1111-1111-111111111111',
        workspaceId: '22222222-2222-2222-2222-222222222222',
        mcpServerId: '33333333-3333-3333-3333-333333333333',
        deletedAt: null,
      },
      select: {
        externalName: true,
        specHash: true,
      },
      orderBy: {
        externalName: 'asc',
      },
    });

    expect(result).toEqual([
      {
        externalName: 'corporate.status.read',
        specHash: 'a'.repeat(64),
      },
    ]);
  });
});
