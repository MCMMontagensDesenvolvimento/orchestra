import { describe, expect, it, vi } from 'vitest';

import {
  McpRemoteCatalogImportPlanPersistenceConflictError,
  McpRemoteCatalogImportPlanPersistenceRepository,
} from '../../src/modules/mcp/remote/mcp-remote-catalog-import-plan.repository';
import {
  McpRemoteCatalogImportPlanService,
} from '../../src/modules/mcp/remote/mcp-remote-catalog-import-plan.service';
import {
  McpRemoteDiscoveryApprovalService,
} from '../../src/modules/mcp/remote/mcp-remote-discovery-approval.service';

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000030';
const serverId = '00000000-0000-0000-0000-000000000701';

function governedPair() {
  const approvalService = new McpRemoteDiscoveryApprovalService();
  const planService = new McpRemoteCatalogImportPlanService();

  const reviewPackage = approvalService.createReviewPackage({
    tenantId,
    workspaceId,
    requestedByUserId: userId,
    requestId: 'req_remote_import_plan_persistence',
    existingTools: [],
    approvalPolicy: {
      allowAutoApproveLowRisk: false,
      allowAutoApproveMediumRisk: false,
      requireHumanReviewForHighRisk: true,
      requireHumanReviewForCriticalRisk: true,
      requireHumanReviewForChangedTools: true,
      requireHumanReviewForRemovedTools: true,
      blockedByDefault: true,
    },
    discovery: {
      serverId,
      status: 'completed',
      discoveredAt: '2026-08-26T17:00:00.000Z',
      tools: [
        {
          externalName: 'corporate.status.read',
          displayName: 'Corporate Status Read',
          description: 'Read corporate readonly status.',
          specHash: 'a'.repeat(64),
          inferredRiskLevel: 'low',
          requiresApproval: false,
          defaultPolicy: {
            allowRuntimeExecution: false,
            sandboxOnly: true,
            blockedByDefault: true,
          },
        },
      ],
      diff: {
        added: ['corporate.status.read'],
        changed: [],
        removed: [],
      },
      warnings: [],
      readiness: {
        status: 'ready',
        failClosed: false,
        remoteEnabled: true,
        discoveryEnabled: true,
        executionEnabled: false,
        serverId: '00000000-0000-0000-0000-000000000701',
        reason: 'Remote MCP discovery is ready.',
        checks: [],
        credentialsConfigured: true,
        authType: 'bearer',
        timeoutMs: 5000,
      },
      sanitizedMetadata: {
        executionBlocked: true,
        transportCalled: true,
        mcpRemoteHost: 'api.example.test',
        toolCount: 1,
      },
    },
  });

  const plan = planService.createImportPlan({
    reviewPackage,
    existingCatalogTools: [],
    importPolicy: {
      allowPlanForPendingReview: true,
      allowPlanForApprovedFutureImport: true,
      allowHighRiskPlan: false,
      allowCriticalRiskPlan: false,
      blockedByDefault: true,
    },
  });

  return {
    reviewPackage,
    plan,
  };
}

function fakeRepository() {
  let stored: any = null;

  const findFirst = vi.fn(async ({ where }: any) => {
    if (!stored) return null;

    if (
      stored.tenantId !== where.tenantId ||
      stored.workspaceId !== where.workspaceId ||
      stored.mcpServerId !== where.mcpServerId ||
      stored.planId !== where.planId
    ) {
      return null;
    }

    return stored;
  });

  const create = vi.fn(async ({ data }: any) => {
    stored = {
      id: '00000000-0000-0000-0000-000000000801',
      consumedAt: null,
      createdAt: new Date('2026-08-26T17:00:00.000Z'),
      updatedAt: new Date('2026-08-26T17:00:00.000Z'),
      ...data,
    };

    return stored;
  });

  const repository =
    new McpRemoteCatalogImportPlanPersistenceRepository({
      mcpRemoteCatalogImportPlanRecord: {
        findFirst,
        create,
      },
    } as never);

  return {
    repository,
    findFirst,
    create,
    getStored: () => stored,
  };
}

describe('MCP remote catalog immutable import plan persistence', () => {
  it('persists review and plan without mutating operational catalog state', async () => {
    const { reviewPackage, plan } = governedPair();
    const { repository, create, getStored } = fakeRepository();

    const result = await repository.persistImmutable({
      reviewPackage,
      plan,
    });

    expect(create).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject({
      tenantId,
      workspaceId,
      mcpServerId: serverId,
      planId: plan.planId,
      planHash: plan.planHash,
      snapshotId: plan.snapshotId,
      snapshotHash: plan.snapshotHash,
      requestedByUserId: userId,
      requestId: plan.requestId,
      sourceDecisionStatus: 'pending_human_review',
      planStatus: 'pending_approval',
      schemaVersion: 1,
      consumedAt: null,
    });

    expect(getStored().reviewPayload).toEqual(reviewPackage);
    expect(getStored().planPayload).toEqual(plan);

    const serialized = JSON.stringify(getStored()).toLowerCase();

    expect(serialized).not.toContain('bearer ');
    expect(serialized).not.toContain('secretref');
    expect(serialized).not.toContain('env://');
  });

  it('is idempotent for the same scoped immutable plan', async () => {
    const pair = governedPair();
    const { repository, create } = fakeRepository();

    const first = await repository.persistImmutable(pair);
    const second = await repository.persistImmutable(pair);

    expect(first.id).toBe(second.id);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('fails closed when an immutable planId already exists with different governed identity', async () => {
    const pair = governedPair();
    const { repository, getStored } = fakeRepository();

    await repository.persistImmutable(pair);

    getStored().snapshotHash = 'b'.repeat(64);

    await expect(
      repository.persistImmutable(pair),
    ).rejects.toMatchObject({
      code: 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT',
    });
  });

  it('rejects planId values that do not match planHash', async () => {
    const pair = governedPair();
    const { repository, create } = fakeRepository();

    const forgedPlan = {
      ...pair.plan,
      planId: 'mcp_remote_catalog_import_plan_forged',
    };

    await expect(
      repository.persistImmutable({
        reviewPackage: pair.reviewPackage,
        plan: forgedPlan,
      }),
    ).rejects.toBeInstanceOf(
      McpRemoteCatalogImportPlanPersistenceConflictError,
    );

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid snapshot hashes before persistence', async () => {
    const pair = governedPair();
    const { repository, create } = fakeRepository();

    await expect(
      repository.persistImmutable({
        reviewPackage: {
          ...pair.reviewPackage,
          snapshotHash: 'invalid',
        },
        plan: {
          ...pair.plan,
          snapshotHash: 'invalid',
        },
      }),
    ).rejects.toMatchObject({
      code: 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT',
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects review and plan scope mismatches', async () => {
    const pair = governedPair();
    const { repository, create } = fakeRepository();

    await expect(
      repository.persistImmutable({
        reviewPackage: {
          ...pair.reviewPackage,
          workspaceId: '00000000-0000-0000-0000-000000009999',
        },
        plan: pair.plan,
      }),
    ).rejects.toMatchObject({
      code: 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT',
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('blocks credential-shaped payloads before database persistence', async () => {
    const pair = governedPair();
    const { repository, create } = fakeRepository();

    const contaminatedReview = {
      ...pair.reviewPackage,
      sanitizedMetadata: {
        ...pair.reviewPackage.sanitizedMetadata,
        note: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
      },
    };

    await expect(
      repository.persistImmutable({
        reviewPackage: contaminatedReview,
        plan: pair.plan,
      }),
    ).rejects.toMatchObject({
      code: 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT',
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('blocks unsafe sensitive keys before database persistence', async () => {
    const pair = governedPair();
    const { repository, create } = fakeRepository();

    const contaminatedReview = {
      ...pair.reviewPackage,
      sanitizedMetadata: {
        ...pair.reviewPackage.sanitizedMetadata,
        secretRef: 'env://SHOULD_NOT_PERSIST',
      },
    };

    await expect(
      repository.persistImmutable({
        reviewPackage: contaminatedReview,
        plan: pair.plan,
      }),
    ).rejects.toMatchObject({
      code: 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT',
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('finds a persisted plan only inside tenant workspace and server scope', async () => {
    const pair = governedPair();
    const { repository } = fakeRepository();

    await repository.persistImmutable(pair);

    await expect(
      repository.findForApply({
        tenantId,
        workspaceId,
        serverId,
        planId: pair.plan.planId,
      }),
    ).resolves.toMatchObject({
      record: expect.objectContaining({
        planId: pair.plan.planId,
      }),
      plan: expect.objectContaining({
        planId: pair.plan.planId,
      }),
    });

    await expect(
      repository.findForApply({
        tenantId,
        workspaceId: '00000000-0000-0000-0000-000000009999',
        serverId,
        planId: pair.plan.planId,
      }),
    ).resolves.toBeNull();
  });
});
