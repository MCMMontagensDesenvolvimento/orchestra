import { describe, expect, it } from 'vitest';

import type { McpRemoteCatalogEntry } from '@/services/mcp.service';
import {
  isMcpRemoteCatalogEntryMaterializable,
  remoteMaterializationSummary,
} from './mcpRemoteMaterialization';

function fixture(
  overrides: Partial<McpRemoteCatalogEntry> = {},
): McpRemoteCatalogEntry {
  return {
    id: 'entry-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    serverId: 'server-1',
    externalName: 'corporate.status.read',
    displayName: 'Corporate Status Read',
    description: 'Read-only corporate status.',
    source: 'remote',
    lifecycleStatus: 'approved_for_catalog',
    riskLevel: 'low',
    requiresApproval: true,
    specHash: 'spec',
    catalogHash: 'catalog',
    policy: {
      allowRuntimeExecution: false,
      sandboxOnly: true,
      blockedByDefault: true,
      approvalMode: 'manual',
      runtimeEnabled: false,
      remoteExecutionEnabled: false,
    },
    snapshot: {
      snapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash',
    },
    lastPlan: {
      planId: 'plan-1',
      planHash: 'plan-hash',
    },
    lastApply: {
      applyId: 'apply-1',
      applyHash: 'apply-hash',
    },
    revision: 1,
    importedByUserId: 'user-1',
    importedAt: '2026-08-31T12:00:00.000Z',
    approvedByUserId: 'user-1',
    approvedAt: '2026-08-31T12:05:00.000Z',
    deprecatedByUserId: null,
    deprecatedAt: null,
    deprecationReasonHash: null,
    materialization: {
      isMaterialized: false,
    },
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:05:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('MCP remote catalog materialization UI gate', () => {
  it('allows only an approved closed-policy entry', () => {
    expect(
      isMcpRemoteCatalogEntryMaterializable(fixture()),
    ).toBe(true);
  });

  it('rejects an already materialized entry', () => {
    expect(
      isMcpRemoteCatalogEntryMaterializable(
        fixture({
          materialization: {
            isMaterialized: true,
          },
        }),
      ),
    ).toBe(false);
  });

  it('rejects any entry that opens runtime execution', () => {
    const entry = fixture();

    expect(
      isMcpRemoteCatalogEntryMaterializable({
        ...entry,
        policy: {
          ...entry.policy,
          allowRuntimeExecution: true,
        },
      }),
    ).toBe(false);

    expect(
      isMcpRemoteCatalogEntryMaterializable({
        ...entry,
        policy: {
          ...entry.policy,
          runtimeEnabled: true,
        },
      }),
    ).toBe(false);

    expect(
      isMcpRemoteCatalogEntryMaterializable({
        ...entry,
        policy: {
          ...entry.policy,
          remoteExecutionEnabled: true,
        },
      }),
    ).toBe(false);
  });

  it('rejects entries without manual approval evidence', () => {
    expect(
      isMcpRemoteCatalogEntryMaterializable(
        fixture({
          approvedAt: null,
        }),
      ),
    ).toBe(false);

    expect(
      isMcpRemoteCatalogEntryMaterializable(
        fixture({
          lifecycleStatus: 'imported',
        }),
      ),
    ).toBe(false);
  });

  it('summarizes materialization without inferring operational state', () => {
    expect(
      remoteMaterializationSummary([]),
    ).toBe('Não realizada');

    expect(
      remoteMaterializationSummary([
        fixture(),
      ]),
    ).toBe('Não realizada');

    expect(
      remoteMaterializationSummary([
        fixture({
          materialization: {
            isMaterialized: true,
          },
        }),
      ]),
    ).toBe('Materializada');
  });
});
