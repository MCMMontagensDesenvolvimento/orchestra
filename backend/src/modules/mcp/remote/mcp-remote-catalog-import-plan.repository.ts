import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../infrastructure/prisma/prisma.service';
import { computeMcpRemoteCatalogImportPlanHash } from './mcp-remote-catalog-import-plan.service';
import type {
  McpRemoteCatalogImportPlan,
  McpRemoteDiscoveryReviewPackage,
} from './mcp-remote.types';

const sha256Pattern = /^[a-f0-9]{64}$/;
const maxPayloadBytes = 2 * 1024 * 1024;

const unsafeKeyFragments = [
  'apikey',
  'authorization',
  'cookie',
  'credential',
  'password',
  'privatekey',
  'secret',
  'secretref',
  'token',
];

const sensitiveTextPattern =
  /(?:\bBearer\s+[A-Za-z0-9._~+/-]{12,}|sk-[A-Za-z0-9]{12,}|https?:\/\/[^/\s:@]+:[^/\s@]+@)/i;

type ImportPlanPrisma = Pick<
  PrismaClient,
  'mcpRemoteCatalogImportPlanRecord'
>;

export class McpRemoteCatalogImportPlanPersistenceConflictError extends Error {
  readonly code = 'MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT';

  constructor(message: string) {
    super(`MCP_REMOTE_IMPORT_PLAN_PERSISTENCE_CONFLICT: ${message}`);
    this.name = 'McpRemoteCatalogImportPlanPersistenceConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedKey(key: string) {
  return key.replace(/[-_\s]/g, '').toLowerCase();
}

function isUnsafeKey(key: string) {
  const normalized = normalizedKey(key);

  return unsafeKeyFragments.some((fragment) =>
    normalized.includes(fragment),
  );
}

function assertPayloadSafe(value: unknown, path = '$'): void {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return;
  }

  if (typeof value === 'string') {
    if (sensitiveTextPattern.test(value)) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        `credential-shaped text was found at ${path}`,
      );
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertPayloadSafe(item, `${path}[${index}]`),
    );
    return;
  }

  if (typeof value !== 'object' || value === undefined) {
    return;
  }

  for (const [key, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (isUnsafeKey(key)) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        `unsafe payload key "${key}" was found at ${path}`,
      );
    }

    assertPayloadSafe(child, `${path}.${key}`);
  }
}

function toImmutableJson(value: unknown): Prisma.InputJsonValue {
  assertPayloadSafe(value);

  const serialized = JSON.stringify(value);

  if (typeof serialized !== 'string') {
    throw new McpRemoteCatalogImportPlanPersistenceConflictError(
      'governed payload is not JSON serializable',
    );
  }

  if (Buffer.byteLength(serialized, 'utf8') > maxPayloadBytes) {
    throw new McpRemoteCatalogImportPlanPersistenceConflictError(
      'governed payload exceeded the persistence size limit',
    );
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function assertHash(value: string, field: string) {
  if (!sha256Pattern.test(value)) {
    throw new McpRemoteCatalogImportPlanPersistenceConflictError(
      `${field} must be a lowercase SHA-256 hash`,
    );
  }
}

function assertPlanIdentity(
  reviewPackage: McpRemoteDiscoveryReviewPackage,
  plan: McpRemoteCatalogImportPlan,
) {
  assertHash(plan.planHash, 'planHash');
  assertHash(plan.snapshotHash, 'snapshotHash');

  const expectedPlanId =
    `mcp_remote_catalog_import_plan_${plan.planHash.slice(0, 24)}`;

  if (plan.planId !== expectedPlanId) {
    throw new McpRemoteCatalogImportPlanPersistenceConflictError(
      'planId does not match planHash',
    );
  }

  const identityChecks: Array<[unknown, unknown, string]> = [
    [reviewPackage.snapshotId, plan.snapshotId, 'snapshotId'],
    [reviewPackage.snapshotHash, plan.snapshotHash, 'snapshotHash'],
    [reviewPackage.serverId, plan.serverId, 'serverId'],
    [reviewPackage.tenantId, plan.tenantId, 'tenantId'],
    [reviewPackage.workspaceId, plan.workspaceId, 'workspaceId'],
    [
      reviewPackage.requestedByUserId,
      plan.requestedByUserId,
      'requestedByUserId',
    ],
    [reviewPackage.requestId, plan.requestId, 'requestId'],
    [
      reviewPackage.decision.status,
      plan.sourceDecisionStatus,
      'sourceDecisionStatus',
    ],
  ];

  for (const [reviewValue, planValue, field] of identityChecks) {
    if (reviewValue !== planValue) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        `${field} differs between review package and import plan`,
      );
    }
  }
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export class McpRemoteCatalogImportPlanPersistenceRepository {
  constructor(
    private readonly db: ImportPlanPrisma = defaultPrisma,
  ) {}

  async persistImmutable(input: {
    reviewPackage: McpRemoteDiscoveryReviewPackage;
    plan: McpRemoteCatalogImportPlan;
  }) {
    assertPlanIdentity(input.reviewPackage, input.plan);

    const reviewPayload = toImmutableJson(input.reviewPackage);
    const planPayload = toImmutableJson(input.plan);

    const where = {
      tenantId: input.plan.tenantId,
      workspaceId: input.plan.workspaceId,
      mcpServerId: input.plan.serverId,
      planId: input.plan.planId,
    };

    const existing =
      await this.db.mcpRemoteCatalogImportPlanRecord.findFirst({
        where,
      });

    if (existing) {
      this.assertExistingMatches(existing, input.plan);
      return existing;
    }

    try {
      return await this.db.mcpRemoteCatalogImportPlanRecord.create({
        data: {
          ...where,
          planHash: input.plan.planHash,
          snapshotId: input.plan.snapshotId,
          snapshotHash: input.plan.snapshotHash,
          requestedByUserId: input.plan.requestedByUserId,
          requestId: input.plan.requestId,
          sourceDecisionStatus: input.plan.sourceDecisionStatus,
          planStatus: input.plan.status,
          reviewPayload,
          planPayload,
          schemaVersion: 1,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const concurrent =
        await this.db.mcpRemoteCatalogImportPlanRecord.findFirst({
          where,
        });

      if (!concurrent) throw error;

      this.assertExistingMatches(concurrent, input.plan);
      return concurrent;
    }
  }

  async findForApply(input: {
    tenantId: string;
    workspaceId: string;
    serverId: string;
    planId: string;
  }) {
    const record = await this.db.mcpRemoteCatalogImportPlanRecord.findFirst({
      where: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        mcpServerId: input.serverId,
        planId: input.planId,
      },
    });

    if (!record) return null;

    assertPayloadSafe(record.planPayload, '$.planPayload');

    if (!isRecord(record.planPayload)) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        'persisted plan payload is not an object',
      );
    }

    const plan = record.planPayload as unknown as McpRemoteCatalogImportPlan;

    if (
      typeof plan.planId !== 'string' ||
      typeof plan.planHash !== 'string' ||
      typeof plan.snapshotId !== 'string' ||
      typeof plan.snapshotHash !== 'string' ||
      typeof plan.serverId !== 'string' ||
      typeof plan.tenantId !== 'string' ||
      typeof plan.workspaceId !== 'string' ||
      typeof plan.requestedByUserId !== 'string' ||
      typeof plan.requestId !== 'string' ||
      typeof plan.createdAt !== 'string' ||
      typeof plan.sourceDecisionStatus !== 'string' ||
      typeof plan.status !== 'string' ||
      !Array.isArray(plan.operations) ||
      !isRecord(plan.summary) ||
      !isRecord(plan.riskSummary) ||
      !isRecord(plan.validation) ||
      !isRecord(plan.preflight) ||
      !isRecord(plan.sanitizedMetadata)
    ) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        'persisted plan payload has an invalid governed shape',
      );
    }

    assertHash(plan.planHash, 'planPayload.planHash');
    assertHash(plan.snapshotHash, 'planPayload.snapshotHash');

    if (
      plan.planId !== record.planId ||
      plan.planHash !== record.planHash ||
      plan.snapshotId !== record.snapshotId ||
      plan.snapshotHash !== record.snapshotHash ||
      plan.serverId !== record.mcpServerId ||
      plan.tenantId !== record.tenantId ||
      plan.workspaceId !== record.workspaceId ||
      plan.requestId !== record.requestId ||
      plan.sourceDecisionStatus !== record.sourceDecisionStatus ||
      plan.status !== record.planStatus
    ) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        'persisted plan payload differs from immutable record identity',
      );
    }

    const expectedPlanId =
      `mcp_remote_catalog_import_plan_${record.planHash.slice(0, 24)}`;

    if (record.planId !== expectedPlanId) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        'persisted planId does not match planHash',
      );
    }

    const recalculatedHash = computeMcpRemoteCatalogImportPlanHash(plan);

    if (recalculatedHash !== record.planHash) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        'persisted plan payload failed canonical hash verification',
      );
    }

    return {
      record,
      plan,
    };
  }

  private assertExistingMatches(
    existing: {
      planHash: string;
      snapshotId: string;
      snapshotHash: string;
      requestId: string;
      sourceDecisionStatus: string;
      planStatus: string;
    },
    plan: McpRemoteCatalogImportPlan,
  ) {
    if (
      existing.planHash !== plan.planHash ||
      existing.snapshotId !== plan.snapshotId ||
      existing.snapshotHash !== plan.snapshotHash ||
      existing.requestId !== plan.requestId ||
      existing.sourceDecisionStatus !== plan.sourceDecisionStatus ||
      existing.planStatus !== plan.status
    ) {
      throw new McpRemoteCatalogImportPlanPersistenceConflictError(
        'an immutable planId already exists with different governed content',
      );
    }
  }
}

export const mcpRemoteCatalogImportPlanPersistenceRepository =
  new McpRemoteCatalogImportPlanPersistenceRepository();
