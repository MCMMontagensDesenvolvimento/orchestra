import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type {
  AiQualityEvaluationResultsQuery,
  AiQualityEvaluationRunsQuery,
  AiQualityTestCasesQuery,
  AiQualityTestSetsQuery,
} from './ai-quality.schema';

type AiQualityPrisma = Pick<
  PrismaClient,
  'aiQualityTestSet' | 'aiQualityTestCase' | 'aiQualityEvaluationRun' | 'aiQualityEvaluationResult' | 'assistant'
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
}

export const aiQualityRepository = new AiQualityRepository();
