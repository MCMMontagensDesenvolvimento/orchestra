import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  AiQualityCreateTestCaseBody,
  AiQualityCreateTestSetBody,
  AiQualityEvaluationResultsQuery,
  AiQualityEvaluationRunResultsQuery,
  AiQualityEvaluationRunsQuery,
  AiQualityTestCasesQuery,
  AiQualityTestSetsQuery,
  AiQualityUpdateTestCaseBody,
  AiQualityUpdateTestSetBody,
} from './ai-quality.schema';
import type { AiQualityRunSummary } from './ai-quality.types';

type AiQualityPrisma = Pick<
  PrismaClient,
  'aiQualityTestSet' | 'aiQualityTestCase' | 'aiQualityEvaluationRun' | 'aiQualityEvaluationResult' | 'assistant' | '$transaction'
>;

const testSetListSelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  name: true,
  description: true,
  status: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.AiQualityTestSetSelect;

const testSetDetailSelect = {
  ...testSetListSelect,
  metadata: true,
} satisfies Prisma.AiQualityTestSetSelect;

const testCaseListSelect = {
  id: true,
  testSetId: true,
  assistantId: true,
  name: true,
  description: true,
  tags: true,
  status: true,
  sortOrder: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.AiQualityTestCaseSelect;

const testCaseDetailSelect = {
  ...testCaseListSelect,
  inputText: true,
  expectedOutput: true,
  assertions: true,
  metadata: true,
  testSet: {
    select: {
      id: true,
      workspaceId: true,
      assistantId: true,
      status: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.AiQualityTestCaseSelect;

const evaluationRunListSelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  testSetId: true,
  status: true,
  mode: true,
  startedAt: true,
  completedAt: true,
  totalCases: true,
  passedCases: true,
  failedCases: true,
  warningCases: true,
  errorCases: true,
  skippedCases: true,
  scoreBasisPoints: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.AiQualityEvaluationRunSelect;

const evaluationRunDetailSelect = {
  ...evaluationRunListSelect,
  metadata: true,
  assistantSnapshotHash: true,
  assistantSnapshotSummary: true,
  testSetSnapshotHash: true,
  testSetSnapshotSummary: true,
} satisfies Prisma.AiQualityEvaluationRunSelect;

const evaluationResultSelect = {
  id: true,
  runId: true,
  testCaseId: true,
  status: true,
  scoreBasisPoints: true,
  assertionResults: true,
  candidateOutputHash: true,
  candidateOutputExcerpt: true,
  errorCode: true,
  errorMessageHash: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AiQualityEvaluationResultSelect;

const assistantSnapshotSelect = {
  id: true,
  workspaceId: true,
  name: true,
  status: true,
} satisfies Prisma.AssistantSelect;

const testSetForRunSelect = {
  id: true,
  workspaceId: true,
  assistantId: true,
  name: true,
  status: true,
  deletedAt: true,
  assistant: {
    select: assistantSnapshotSelect,
  },
  testCases: {
    where: {
      status: 'active',
      deletedAt: null,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      id: true,
      assistantId: true,
      name: true,
      inputText: true,
      assertions: true,
      status: true,
      sortOrder: true,
      deletedAt: true,
    },
  },
  _count: {
    select: {
      testCases: true,
    },
  },
} satisfies Prisma.AiQualityTestSetSelect;

const evaluationRunWithResultsSelect = {
  ...evaluationRunDetailSelect,
  results: {
    select: evaluationResultSelect,
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.AiQualityEvaluationRunSelect;

export type AiQualityTestSetListRecord = Prisma.AiQualityTestSetGetPayload<{
  select: typeof testSetListSelect;
}>;
export type AiQualityTestSetDetailRecord = Prisma.AiQualityTestSetGetPayload<{
  select: typeof testSetDetailSelect;
}>;
export type AiQualityTestCaseListRecord = Prisma.AiQualityTestCaseGetPayload<{
  select: typeof testCaseListSelect;
}>;
export type AiQualityTestCaseDetailRecord = Prisma.AiQualityTestCaseGetPayload<{
  select: typeof testCaseDetailSelect;
}>;
export type AiQualityEvaluationRunListRecord = Prisma.AiQualityEvaluationRunGetPayload<{
  select: typeof evaluationRunListSelect;
}>;
export type AiQualityEvaluationRunDetailRecord = Prisma.AiQualityEvaluationRunGetPayload<{
  select: typeof evaluationRunDetailSelect;
}>;
export type AiQualityEvaluationResultRecord = Prisma.AiQualityEvaluationResultGetPayload<{
  select: typeof evaluationResultSelect;
}>;
export type AiQualityAssistantSnapshotRecord = Prisma.AssistantGetPayload<{
  select: typeof assistantSnapshotSelect;
}>;
export type AiQualityTestSetForRunRecord = Prisma.AiQualityTestSetGetPayload<{
  select: typeof testSetForRunSelect;
}>;
export type AiQualityEvaluationRunWithResultsRecord = Prisma.AiQualityEvaluationRunGetPayload<{
  select: typeof evaluationRunWithResultsSelect;
}>;

export interface AiQualityCreateEvaluationRunResultInput {
  testCaseId: string;
  status: string;
  scoreBasisPoints: number;
  assertionResults: unknown;
  candidateOutputHash: string | null;
  candidateOutputExcerpt: string | null;
  errorCode?: string | null;
  errorMessageHash?: string | null;
  metadata?: unknown;
}

export interface AiQualityCreateEvaluationRunInput {
  tenantId: string;
  workspaceId?: string | null;
  assistantId?: string | null;
  testSetId: string;
  summary: AiQualityRunSummary;
  startedAt: Date;
  completedAt: Date;
  metadata?: unknown;
  createdByUserId?: string | null;
  assistantSnapshotHash?: string | null;
  assistantSnapshotSummary?: unknown;
  testSetSnapshotHash: string;
  testSetSnapshotSummary: unknown;
  results: AiQualityCreateEvaluationRunResultInput[];
}

function visibleWorkspaceIds(queryWorkspaceId: string | undefined, workspaceIds: string[]) {
  return queryWorkspaceId ? [queryWorkspaceId] : workspaceIds;
}

function testSetScopeWhere(
  tenantId: string,
  workspaceIds: string[],
): Prisma.AiQualityTestSetWhereInput {
  const workspaceClauses: Prisma.AiQualityTestSetWhereInput[] = workspaceIds.length > 0
    ? [
      { workspaceId: { in: workspaceIds } },
      {
        assistant: {
          is: {
            tenantId,
            workspaceId: { in: workspaceIds },
            deletedAt: null,
          },
        },
      },
    ]
    : [];

  return {
    OR: [
      { workspaceId: null, assistantId: null },
      ...workspaceClauses,
    ],
  };
}

function testSetsWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiQualityTestSetsQuery,
): Prisma.AiQualityTestSetWhereInput {
  const scopedWorkspaceIds = visibleWorkspaceIds(query.workspaceId, workspaceIds);
  return {
    tenantId,
    AND: [testSetScopeWhere(tenantId, scopedWorkspaceIds)],
    ...(query.assistantId ? { assistantId: query.assistantId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(!query.includeDeleted ? { deletedAt: null } : {}),
  };
}

function testCaseScopeWhere(
  tenantId: string,
  workspaceIds: string[],
): Prisma.AiQualityTestCaseWhereInput {
  return {
    testSet: {
      is: {
        tenantId,
        AND: [testSetScopeWhere(tenantId, workspaceIds)],
      },
    },
  };
}

function testCasesWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiQualityTestCasesQuery,
): Prisma.AiQualityTestCaseWhereInput {
  const scopedWorkspaceIds = visibleWorkspaceIds(query.workspaceId, workspaceIds);
  return {
    tenantId,
    AND: [testCaseScopeWhere(tenantId, scopedWorkspaceIds)],
    ...(query.testSetId ? { testSetId: query.testSetId } : {}),
    ...(query.assistantId ? { assistantId: query.assistantId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(!query.includeDeleted ? { deletedAt: null } : {}),
  };
}

function evaluationRunScopeWhere(
  tenantId: string,
  workspaceIds: string[],
): Prisma.AiQualityEvaluationRunWhereInput {
  const workspaceClauses: Prisma.AiQualityEvaluationRunWhereInput[] = workspaceIds.length > 0
    ? [
      { workspaceId: { in: workspaceIds } },
      {
        assistant: {
          is: {
            tenantId,
            workspaceId: { in: workspaceIds },
            deletedAt: null,
          },
        },
      },
    ]
    : [];

  return {
    AND: [
      {
        OR: [
          { workspaceId: null, assistantId: null },
          ...workspaceClauses,
        ],
      },
      {
        testSet: {
          is: {
            tenantId,
            AND: [testSetScopeWhere(tenantId, workspaceIds)],
          },
        },
      },
    ],
  };
}

function evaluationRunsWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiQualityEvaluationRunsQuery,
): Prisma.AiQualityEvaluationRunWhereInput {
  const scopedWorkspaceIds = visibleWorkspaceIds(query.workspaceId, workspaceIds);
  return {
    tenantId,
    AND: [evaluationRunScopeWhere(tenantId, scopedWorkspaceIds)],
    ...(query.assistantId ? { assistantId: query.assistantId } : {}),
    ...(query.testSetId ? { testSetId: query.testSetId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.mode ? { mode: query.mode } : {}),
    ...(!query.includeDeleted ? { deletedAt: null } : {}),
  };
}

function evaluationResultsWhere(
  tenantId: string,
  workspaceIds: string[],
  query: AiQualityEvaluationResultsQuery,
): Prisma.AiQualityEvaluationResultWhereInput {
  const scopedWorkspaceIds = visibleWorkspaceIds(query.workspaceId, workspaceIds);
  return {
    tenantId,
    run: {
      is: {
        tenantId,
        AND: [evaluationRunScopeWhere(tenantId, scopedWorkspaceIds)],
      },
    },
    ...(query.runId ? { runId: query.runId } : {}),
    ...(query.testCaseId ? { testCaseId: query.testCaseId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

function orderBy<TSort extends string>(sort: TSort) {
  const [sortBy, sortDirection] = sort.split(':') as [string, 'asc' | 'desc'];
  return { [sortBy]: sortDirection };
}

function jsonOrUndefined(value: unknown) {
  if (value === null || typeof value === 'undefined') return undefined;
  return value as Prisma.InputJsonValue;
}

function nullableJson(value: unknown) {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

export class AiQualityRepository {
  constructor(private readonly db: AiQualityPrisma = defaultPrisma) {}

  async listTestSets(tenantId: string, workspaceIds: string[], query: AiQualityTestSetsQuery) {
    const where = testSetsWhere(tenantId, workspaceIds, query);
    const [data, total] = await Promise.all([
      this.db.aiQualityTestSet.findMany({
        where,
        select: testSetListSelect,
        orderBy: orderBy(query.sort) as Prisma.AiQualityTestSetOrderByWithRelationInput,
        ...paginationOffset(query),
      }),
      this.db.aiQualityTestSet.count({ where }),
    ]);
    return { data, total };
  }

  createTestSet(input: AiQualityCreateTestSetBody & { tenantId: string; userId: string }) {
    return this.db.aiQualityTestSet.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId ?? null,
        assistantId: input.assistantId ?? null,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        metadata: nullableJson(input.metadata),
        createdByUserId: input.userId,
        updatedByUserId: input.userId,
      },
      select: testSetDetailSelect,
    });
  }

  updateTestSet(id: string, input: AiQualityUpdateTestSetBody & { userId: string }) {
    return this.db.aiQualityTestSet.update({
      where: { id },
      data: {
        ...(typeof input.workspaceId !== 'undefined' ? { workspaceId: input.workspaceId } : {}),
        ...(typeof input.assistantId !== 'undefined' ? { assistantId: input.assistantId } : {}),
        ...(typeof input.name !== 'undefined' ? { name: input.name } : {}),
        ...(typeof input.description !== 'undefined' ? { description: input.description } : {}),
        ...(typeof input.status !== 'undefined' ? { status: input.status } : {}),
        ...(typeof input.metadata !== 'undefined' ? { metadata: nullableJson(input.metadata) } : {}),
        updatedByUserId: input.userId,
      },
      select: testSetDetailSelect,
    });
  }

  setTestSetStatus(id: string, status: 'active' | 'archived', userId: string) {
    return this.db.aiQualityTestSet.update({
      where: { id },
      data: { status, updatedByUserId: userId },
      select: testSetDetailSelect,
    });
  }

  findTestSet(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.aiQualityTestSet.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        AND: [testSetScopeWhere(tenantId, workspaceIds)],
      },
      select: testSetDetailSelect,
    });
  }

  findActiveTestSetForRun(
    id: string,
    tenantId: string,
    workspaceIds: string[],
    workspaceId?: string,
  ) {
    const scopedWorkspaceIds = visibleWorkspaceIds(workspaceId, workspaceIds);
    return this.db.aiQualityTestSet.findFirst({
      where: {
        id,
        tenantId,
        status: 'active',
        deletedAt: null,
        AND: [testSetScopeWhere(tenantId, scopedWorkspaceIds)],
      },
      select: testSetForRunSelect,
    });
  }

  async listTestCases(tenantId: string, workspaceIds: string[], query: AiQualityTestCasesQuery) {
    const where = testCasesWhere(tenantId, workspaceIds, query);
    const [data, total] = await Promise.all([
      this.db.aiQualityTestCase.findMany({
        where,
        select: testCaseListSelect,
        orderBy: orderBy(query.sort) as Prisma.AiQualityTestCaseOrderByWithRelationInput,
        ...paginationOffset(query),
      }),
      this.db.aiQualityTestCase.count({ where }),
    ]);
    return { data, total };
  }

  createTestCase(input: AiQualityCreateTestCaseBody & { tenantId: string; userId: string }) {
    return this.db.aiQualityTestCase.create({
      data: {
        tenantId: input.tenantId,
        testSetId: input.testSetId,
        assistantId: input.assistantId ?? null,
        name: input.name,
        description: input.description ?? null,
        inputText: input.inputText,
        expectedOutput: input.expectedOutput ?? null,
        assertions: input.assertions as Prisma.InputJsonValue,
        tags: nullableJson(input.tags),
        status: input.status,
        sortOrder: input.sortOrder,
        metadata: nullableJson(input.metadata),
        createdByUserId: input.userId,
        updatedByUserId: input.userId,
      },
      select: testCaseDetailSelect,
    });
  }

  updateTestCase(id: string, input: AiQualityUpdateTestCaseBody & { userId: string }) {
    return this.db.aiQualityTestCase.update({
      where: { id },
      data: {
        ...(typeof input.assistantId !== 'undefined' ? { assistantId: input.assistantId } : {}),
        ...(typeof input.name !== 'undefined' ? { name: input.name } : {}),
        ...(typeof input.description !== 'undefined' ? { description: input.description } : {}),
        ...(typeof input.inputText !== 'undefined' ? { inputText: input.inputText } : {}),
        ...(typeof input.expectedOutput !== 'undefined' ? { expectedOutput: input.expectedOutput } : {}),
        ...(typeof input.assertions !== 'undefined'
          ? { assertions: input.assertions as Prisma.InputJsonValue }
          : {}),
        ...(typeof input.tags !== 'undefined' ? { tags: nullableJson(input.tags) } : {}),
        ...(typeof input.status !== 'undefined' ? { status: input.status } : {}),
        ...(typeof input.sortOrder !== 'undefined' ? { sortOrder: input.sortOrder } : {}),
        ...(typeof input.metadata !== 'undefined' ? { metadata: nullableJson(input.metadata) } : {}),
        updatedByUserId: input.userId,
      },
      select: testCaseDetailSelect,
    });
  }

  setTestCaseStatus(id: string, status: 'active' | 'archived', userId: string) {
    return this.db.aiQualityTestCase.update({
      where: { id },
      data: { status, updatedByUserId: userId },
      select: testCaseDetailSelect,
    });
  }

  findTestCase(
    id: string,
    tenantId: string,
    workspaceIds: string[],
    workspaceId?: string,
  ) {
    const scopedWorkspaceIds = visibleWorkspaceIds(workspaceId, workspaceIds);
    return this.db.aiQualityTestCase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        AND: [testCaseScopeWhere(tenantId, scopedWorkspaceIds)],
      },
      select: testCaseDetailSelect,
    });
  }

  async listEvaluationRuns(tenantId: string, workspaceIds: string[], query: AiQualityEvaluationRunsQuery) {
    const where = evaluationRunsWhere(tenantId, workspaceIds, query);
    const [data, total] = await Promise.all([
      this.db.aiQualityEvaluationRun.findMany({
        where,
        select: evaluationRunListSelect,
        orderBy: orderBy(query.sort) as Prisma.AiQualityEvaluationRunOrderByWithRelationInput,
        ...paginationOffset(query),
      }),
      this.db.aiQualityEvaluationRun.count({ where }),
    ]);
    return { data, total };
  }

  findEvaluationRun(id: string, tenantId: string, workspaceIds: string[]) {
    return this.db.aiQualityEvaluationRun.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        AND: [evaluationRunScopeWhere(tenantId, workspaceIds)],
      },
      select: evaluationRunDetailSelect,
    });
  }

  async listEvaluationResults(tenantId: string, workspaceIds: string[], query: AiQualityEvaluationResultsQuery) {
    const where = evaluationResultsWhere(tenantId, workspaceIds, query);
    const [data, total] = await Promise.all([
      this.db.aiQualityEvaluationResult.findMany({
        where,
        select: evaluationResultSelect,
        orderBy: orderBy(query.sort) as Prisma.AiQualityEvaluationResultOrderByWithRelationInput,
        ...paginationOffset(query),
      }),
      this.db.aiQualityEvaluationResult.count({ where }),
    ]);
    return { data, total };
  }

  async listEvaluationResultsForRun(
    tenantId: string,
    workspaceIds: string[],
    runId: string,
    query: AiQualityEvaluationRunResultsQuery,
  ) {
    return this.listEvaluationResults(tenantId, workspaceIds, {
      ...query,
      runId,
    });
  }

  async createEvaluationRunWithResults(input: AiQualityCreateEvaluationRunInput) {
    const run = await this.db.$transaction((tx) => tx.aiQualityEvaluationRun.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId ?? null,
        assistantId: input.assistantId ?? null,
        testSetId: input.testSetId,
        status: 'completed',
        mode: 'deterministic',
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        totalCases: input.summary.totalCases,
        passedCases: input.summary.passedCases,
        failedCases: input.summary.failedCases,
        warningCases: input.summary.warningCases,
        errorCases: input.summary.errorCases,
        skippedCases: input.summary.skippedCases,
        scoreBasisPoints: input.summary.scoreBasisPoints,
        metadata: jsonOrUndefined(input.metadata),
        createdByUserId: input.createdByUserId ?? null,
        assistantSnapshotHash: input.assistantSnapshotHash ?? null,
        assistantSnapshotSummary: jsonOrUndefined(input.assistantSnapshotSummary),
        testSetSnapshotHash: input.testSetSnapshotHash,
        testSetSnapshotSummary: jsonOrUndefined(input.testSetSnapshotSummary),
        results: {
          create: input.results.map((result) => ({
            tenantId: input.tenantId,
            testCaseId: result.testCaseId,
            status: result.status,
            scoreBasisPoints: result.scoreBasisPoints,
            assertionResults: result.assertionResults as Prisma.InputJsonValue,
            candidateOutputHash: result.candidateOutputHash,
            candidateOutputExcerpt: result.candidateOutputExcerpt,
            errorCode: result.errorCode ?? null,
            errorMessageHash: result.errorMessageHash ?? null,
            metadata: jsonOrUndefined(result.metadata),
          })),
        },
      },
      select: evaluationRunWithResultsSelect,
    }));
    return run;
  }

  async isAssistantAccessible(input: {
    tenantId: string;
    workspaceIds: string[];
    workspaceId?: string;
    assistantId?: string | null;
  }) {
    if (!input.assistantId) return true;
    const scopedWorkspaceIds = visibleWorkspaceIds(input.workspaceId, input.workspaceIds);
    if (scopedWorkspaceIds.length === 0) return false;

    const assistant = await this.db.assistant.findFirst({
      where: {
        id: input.assistantId,
        tenantId: input.tenantId,
        workspaceId: { in: scopedWorkspaceIds },
        deletedAt: null,
      },
      select: { id: true },
    });
    return Boolean(assistant);
  }

  async findAssistantForRun(input: {
    tenantId: string;
    workspaceIds: string[];
    workspaceId?: string;
    assistantId: string;
  }) {
    const scopedWorkspaceIds = visibleWorkspaceIds(input.workspaceId, input.workspaceIds);
    if (scopedWorkspaceIds.length === 0) return null;

    return this.db.assistant.findFirst({
      where: {
        id: input.assistantId,
        tenantId: input.tenantId,
        workspaceId: { in: scopedWorkspaceIds },
        deletedAt: null,
      },
      select: assistantSnapshotSelect,
    });
  }
}

export const aiQualityRepository = new AiQualityRepository();
