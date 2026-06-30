import type { Prisma } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { evaluateAiQualityTestCase } from './ai-quality-evaluator.service';
import {
  mapAiQualityEvaluationResult,
  mapAiQualityEvaluationRunDetail,
  mapAiQualityEvaluationRunList,
  mapAiQualityEvaluationRunWithResults,
  mapAiQualityTestCaseDetail,
  mapAiQualityTestCaseEvaluation,
  mapAiQualityTestCaseList,
  mapAiQualityTestSetDetail,
  mapAiQualityTestSetList,
} from './ai-quality.mapper';
import { aiQualityRepository } from './ai-quality.repository';
import {
  buildAiQualityAssistantSnapshot,
  buildAiQualityTestSetSnapshot,
  evaluateAiQualityTestSetDeterministically,
} from './ai-quality-runner.service';
import { sanitizeAiQualityMetadata } from './ai-quality.sanitizer';
import type {
  AiQualityCreateTestCaseBody,
  AiQualityCreateTestSetBody,
  AiQualityCreateDeterministicRunBody,
  AiQualityEvaluateTestCaseBody,
  AiQualityEvaluationResultsQuery,
  AiQualityEvaluationRunResultsQuery,
  AiQualityEvaluationRunsQuery,
  AiQualityTestCasesQuery,
  AiQualityTestSetsQuery,
  AiQualityUpdateTestCaseBody,
  AiQualityUpdateTestSetBody,
} from './ai-quality.schema';
import type { AiQualityRequestContext } from './ai-quality.types';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function assertWorkspaceFilter(user: AuthenticatedUser, workspaceId: string | undefined) {
  if (!workspaceId) return;
  if (!userWorkspaceIds(user).includes(workspaceId)) {
    throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
  }
}

function assertWorkspaceBody(user: AuthenticatedUser, workspaceId: string | null | undefined) {
  if (workspaceId) assertWorkspaceFilter(user, workspaceId);
}

async function assertAssistantAccessible(input: {
  user: AuthenticatedUser;
  workspaceId?: string | null;
  assistantId?: string | null;
}) {
  if (!input.assistantId) return;
  const accessible = await aiQualityRepository.isAssistantAccessible({
    tenantId: input.user.tenant.id,
    workspaceIds: userWorkspaceIds(input.user),
    workspaceId: input.workspaceId ?? undefined,
    assistantId: input.assistantId,
  });
  if (!accessible) {
    throw new AppError(404, 'AI_QUALITY_ASSISTANT_NOT_FOUND', 'Assistente de IA nao encontrado no escopo informado.');
  }
}

async function auditWrite(input: {
  user: AuthenticatedUser;
  context: AiQualityRequestContext;
  workspaceId?: string | null;
  action: string;
  entity: 'ai_quality_test_set' | 'ai_quality_test_case' | 'ai_quality_evaluation_run';
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await recordAuditEvent({
    tenantId: input.user.tenant.id,
    workspaceId: input.workspaceId ?? undefined,
    actorUserId: input.user.id,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
  });
}

export const aiQualityService = {
  async createTestSet(
    user: AuthenticatedUser,
    body: AiQualityCreateTestSetBody,
    context: AiQualityRequestContext,
  ) {
    assertWorkspaceBody(user, body.workspaceId);
    await assertAssistantAccessible({ user, workspaceId: body.workspaceId, assistantId: body.assistantId });
    const testSet = await aiQualityRepository.createTestSet({
      ...body,
      tenantId: user.tenant.id,
      userId: user.id,
      metadata: sanitizeAiQualityMetadata(body.metadata) as AiQualityCreateTestSetBody['metadata'],
    });
    await auditWrite({
      user,
      context,
      workspaceId: testSet.workspaceId,
      action: 'ai_quality_test_set_created',
      entity: 'ai_quality_test_set',
      entityId: testSet.id,
      metadata: { assistantId: testSet.assistantId, status: testSet.status },
    });
    return mapAiQualityTestSetDetail(testSet);
  },

  async listTestSets(user: AuthenticatedUser, query: AiQualityTestSetsQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiQualityRepository.listTestSets(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAiQualityTestSetList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getTestSet(id: string, user: AuthenticatedUser) {
    const testSet = await aiQualityRepository.findTestSet(id, user.tenant.id, userWorkspaceIds(user));
    if (!testSet) {
      throw new AppError(404, 'AI_QUALITY_TEST_SET_NOT_FOUND', 'Test set de qualidade de IA nao encontrado.');
    }
    return mapAiQualityTestSetDetail(testSet);
  },

  async updateTestSet(
    id: string,
    user: AuthenticatedUser,
    body: AiQualityUpdateTestSetBody,
    context: AiQualityRequestContext,
  ) {
    const current = await aiQualityRepository.findTestSet(id, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'AI_QUALITY_TEST_SET_NOT_FOUND', 'Test set de qualidade de IA nao encontrado.');
    }
    const workspaceId = typeof body.workspaceId === 'undefined' ? current.workspaceId : body.workspaceId;
    const assistantId = typeof body.assistantId === 'undefined' ? current.assistantId : body.assistantId;
    assertWorkspaceBody(user, workspaceId);
    await assertAssistantAccessible({ user, workspaceId, assistantId });
    const testSet = await aiQualityRepository.updateTestSet(id, {
      ...body,
      userId: user.id,
      ...(typeof body.metadata !== 'undefined'
        ? { metadata: sanitizeAiQualityMetadata(body.metadata) as AiQualityUpdateTestSetBody['metadata'] }
        : {}),
    });
    await auditWrite({
      user,
      context,
      workspaceId: testSet.workspaceId,
      action: 'ai_quality_test_set_updated',
      entity: 'ai_quality_test_set',
      entityId: testSet.id,
      metadata: { assistantId: testSet.assistantId, status: testSet.status, changedFields: Object.keys(body).sort() },
    });
    return mapAiQualityTestSetDetail(testSet);
  },

  async setTestSetArchived(
    id: string,
    user: AuthenticatedUser,
    archived: boolean,
    context: AiQualityRequestContext,
  ) {
    const current = await aiQualityRepository.findTestSet(id, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'AI_QUALITY_TEST_SET_NOT_FOUND', 'Test set de qualidade de IA nao encontrado.');
    }
    const testSet = await aiQualityRepository.setTestSetStatus(id, archived ? 'archived' : 'active', user.id);
    await auditWrite({
      user,
      context,
      workspaceId: testSet.workspaceId,
      action: archived ? 'ai_quality_test_set_archived' : 'ai_quality_test_set_restored',
      entity: 'ai_quality_test_set',
      entityId: testSet.id,
      metadata: { previousStatus: current.status, status: testSet.status },
    });
    return mapAiQualityTestSetDetail(testSet);
  },

  async createTestCase(
    user: AuthenticatedUser,
    body: AiQualityCreateTestCaseBody,
    context: AiQualityRequestContext,
  ) {
    const testSet = await aiQualityRepository.findTestSet(body.testSetId, user.tenant.id, userWorkspaceIds(user));
    if (!testSet) {
      throw new AppError(404, 'AI_QUALITY_TEST_SET_NOT_FOUND', 'Test set de qualidade de IA nao encontrado.');
    }
    if (testSet.status === 'archived') {
      throw new AppError(422, 'AI_QUALITY_TEST_SET_ARCHIVED', 'Test set arquivado nao aceita novos casos de teste.');
    }
    if (testSet.assistantId && body.assistantId && testSet.assistantId !== body.assistantId) {
      throw new AppError(422, 'AI_QUALITY_ASSISTANT_MISMATCH', 'assistantId informado nao corresponde ao test set.');
    }
    await assertAssistantAccessible({
      user,
      workspaceId: testSet.workspaceId,
      assistantId: body.assistantId,
    });
    const testCase = await aiQualityRepository.createTestCase({
      ...body,
      tenantId: user.tenant.id,
      userId: user.id,
      metadata: sanitizeAiQualityMetadata(body.metadata) as AiQualityCreateTestCaseBody['metadata'],
    });
    await auditWrite({
      user,
      context,
      workspaceId: testSet.workspaceId,
      action: 'ai_quality_test_case_created',
      entity: 'ai_quality_test_case',
      entityId: testCase.id,
      metadata: {
        testSetId: testCase.testSetId,
        assistantId: testCase.assistantId,
        status: testCase.status,
        assertionCount: body.assertions.length,
        tagCount: body.tags?.length ?? 0,
      },
    });
    return mapAiQualityTestCaseDetail(testCase);
  },

  async listTestCases(user: AuthenticatedUser, query: AiQualityTestCasesQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiQualityRepository.listTestCases(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAiQualityTestCaseList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getTestCase(id: string, user: AuthenticatedUser) {
    const testCase = await aiQualityRepository.findTestCase(id, user.tenant.id, userWorkspaceIds(user));
    if (!testCase) {
      throw new AppError(404, 'AI_QUALITY_TEST_CASE_NOT_FOUND', 'Caso de teste de qualidade de IA nao encontrado.');
    }
    return mapAiQualityTestCaseDetail(testCase);
  },

  async updateTestCase(
    id: string,
    user: AuthenticatedUser,
    body: AiQualityUpdateTestCaseBody,
    context: AiQualityRequestContext,
  ) {
    const current = await aiQualityRepository.findTestCase(id, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'AI_QUALITY_TEST_CASE_NOT_FOUND', 'Caso de teste de qualidade de IA nao encontrado.');
    }
    const assistantId = typeof body.assistantId === 'undefined' ? current.assistantId : body.assistantId;
    if (current.testSet.assistantId && assistantId && current.testSet.assistantId !== assistantId) {
      throw new AppError(422, 'AI_QUALITY_ASSISTANT_MISMATCH', 'assistantId informado nao corresponde ao test set.');
    }
    await assertAssistantAccessible({ user, workspaceId: current.testSet.workspaceId, assistantId });
    const testCase = await aiQualityRepository.updateTestCase(id, {
      ...body,
      userId: user.id,
      ...(typeof body.metadata !== 'undefined'
        ? { metadata: sanitizeAiQualityMetadata(body.metadata) as AiQualityUpdateTestCaseBody['metadata'] }
        : {}),
    });
    await auditWrite({
      user,
      context,
      workspaceId: current.testSet.workspaceId,
      action: 'ai_quality_test_case_updated',
      entity: 'ai_quality_test_case',
      entityId: testCase.id,
      metadata: {
        testSetId: testCase.testSetId,
        status: testCase.status,
        changedFields: Object.keys(body).sort(),
        assertionCount: body.assertions?.length,
        tagCount: body.tags?.length,
      },
    });
    return mapAiQualityTestCaseDetail(testCase);
  },

  async setTestCaseArchived(
    id: string,
    user: AuthenticatedUser,
    archived: boolean,
    context: AiQualityRequestContext,
  ) {
    const current = await aiQualityRepository.findTestCase(id, user.tenant.id, userWorkspaceIds(user));
    if (!current) {
      throw new AppError(404, 'AI_QUALITY_TEST_CASE_NOT_FOUND', 'Caso de teste de qualidade de IA nao encontrado.');
    }
    const testCase = await aiQualityRepository.setTestCaseStatus(id, archived ? 'archived' : 'active', user.id);
    await auditWrite({
      user,
      context,
      workspaceId: current.testSet.workspaceId,
      action: archived ? 'ai_quality_test_case_archived' : 'ai_quality_test_case_restored',
      entity: 'ai_quality_test_case',
      entityId: testCase.id,
      metadata: { testSetId: testCase.testSetId, previousStatus: current.status, status: testCase.status },
    });
    return mapAiQualityTestCaseDetail(testCase);
  },

  async listEvaluationRuns(user: AuthenticatedUser, query: AiQualityEvaluationRunsQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiQualityRepository.listEvaluationRuns(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAiQualityEvaluationRunList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getEvaluationRun(id: string, user: AuthenticatedUser) {
    const run = await aiQualityRepository.findEvaluationRun(id, user.tenant.id, userWorkspaceIds(user));
    if (!run) {
      throw new AppError(404, 'AI_QUALITY_EVALUATION_RUN_NOT_FOUND', 'Run de avaliacao de qualidade de IA nao encontrado.');
    }
    return mapAiQualityEvaluationRunDetail(run);
  },

  async getEvaluationRunResults(
    id: string,
    user: AuthenticatedUser,
    query: AiQualityEvaluationRunResultsQuery,
  ) {
    const workspaceIds = userWorkspaceIds(user);
    const run = await aiQualityRepository.findEvaluationRun(id, user.tenant.id, workspaceIds);
    if (!run) {
      throw new AppError(404, 'AI_QUALITY_EVALUATION_RUN_NOT_FOUND', 'Run de avaliacao de qualidade de IA nao encontrado.');
    }
    const result = await aiQualityRepository.listEvaluationResultsForRun(
      user.tenant.id,
      workspaceIds,
      id,
      query,
    );
    return {
      data: result.data.map(mapAiQualityEvaluationResult),
      pagination: paginationMeta(query, result.total),
    };
  },

  async listEvaluationResults(user: AuthenticatedUser, query: AiQualityEvaluationResultsQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiQualityRepository.listEvaluationResults(user.tenant.id, userWorkspaceIds(user), query);
    return {
      data: result.data.map(mapAiQualityEvaluationResult),
      pagination: paginationMeta(query, result.total),
    };
  },

  async evaluateTestCase(user: AuthenticatedUser, body: AiQualityEvaluateTestCaseBody) {
    assertWorkspaceFilter(user, body.workspaceId);
    const workspaceIds = userWorkspaceIds(user);

    if (body.testCaseId) {
      const testCase = await aiQualityRepository.findTestCase(
        body.testCaseId,
        user.tenant.id,
        workspaceIds,
        body.workspaceId,
      );
      if (!testCase) {
        throw new AppError(404, 'AI_QUALITY_TEST_CASE_NOT_FOUND', 'Caso de teste de qualidade de IA nao encontrado.');
      }

      const evaluation = evaluateAiQualityTestCase({
        tenantId: user.tenant.id,
        workspaceId: body.workspaceId ?? testCase.testSet.workspaceId,
        assistantId: testCase.assistantId ?? testCase.testSet.assistantId,
        testCaseId: testCase.id,
        inputText: testCase.inputText,
        candidateOutput: body.candidateOutput,
        assertions: testCase.assertions as any,
        metadata: body.metadata,
      });
      return mapAiQualityTestCaseEvaluation(evaluation);
    }

    const assistantAccessible = await aiQualityRepository.isAssistantAccessible({
      tenantId: user.tenant.id,
      workspaceIds,
      workspaceId: body.workspaceId,
      assistantId: body.assistantId,
    });
    if (!assistantAccessible) {
      throw new AppError(404, 'AI_QUALITY_ASSISTANT_NOT_FOUND', 'Assistente de IA nao encontrado no escopo informado.');
    }

    const evaluation = evaluateAiQualityTestCase({
      tenantId: user.tenant.id,
      workspaceId: body.workspaceId,
      assistantId: body.assistantId,
      inputText: body.inputText,
      candidateOutput: body.candidateOutput,
      assertions: body.assertions ?? [],
      metadata: body.metadata,
    });
    return mapAiQualityTestCaseEvaluation(evaluation);
  },

  async createDeterministicEvaluationRun(
    user: AuthenticatedUser,
    body: AiQualityCreateDeterministicRunBody,
    context: AiQualityRequestContext,
  ) {
    assertWorkspaceFilter(user, body.workspaceId);
    const workspaceIds = userWorkspaceIds(user);
    const testSet = await aiQualityRepository.findActiveTestSetForRun(
      body.testSetId,
      user.tenant.id,
      workspaceIds,
      body.workspaceId,
    );
    if (!testSet) {
      throw new AppError(404, 'AI_QUALITY_TEST_SET_NOT_FOUND', 'Test set de qualidade de IA nao encontrado.');
    }
    if (testSet.testCases.length === 0) {
      throw new AppError(422, 'AI_QUALITY_TEST_SET_EMPTY', 'Test set nao possui test cases ativos para avaliacao.');
    }
    if (testSet.assistantId && body.assistantId && testSet.assistantId !== body.assistantId) {
      throw new AppError(422, 'AI_QUALITY_ASSISTANT_MISMATCH', 'assistantId informado nao corresponde ao test set.');
    }

    const assistantId = body.assistantId ?? testSet.assistantId ?? null;
    let assistant = testSet.assistant;
    if (assistantId && assistant?.id !== assistantId) {
      assistant = await aiQualityRepository.findAssistantForRun({
        tenantId: user.tenant.id,
        workspaceIds,
        workspaceId: body.workspaceId,
        assistantId,
      });
      if (!assistant) {
        throw new AppError(404, 'AI_QUALITY_ASSISTANT_NOT_FOUND', 'Assistente de IA nao encontrado no escopo informado.');
      }
    }

    const startedAt = new Date();
    const selectedWorkspaceId = body.workspaceId ?? testSet.workspaceId ?? assistant?.workspaceId ?? null;
    const evaluation = evaluateAiQualityTestSetDeterministically({
      tenantId: user.tenant.id,
      workspaceId: selectedWorkspaceId,
      assistantId,
      testSet,
      caseOutputs: body.caseOutputs,
      now: startedAt,
    });
    const completedAt = new Date();
    const assistantSnapshot = buildAiQualityAssistantSnapshot(assistant, startedAt);
    const testSetSnapshot = buildAiQualityTestSetSnapshot(testSet, startedAt);

    const run = await aiQualityRepository.createEvaluationRunWithResults({
      tenantId: user.tenant.id,
      workspaceId: selectedWorkspaceId,
      assistantId,
      testSetId: testSet.id,
      summary: evaluation.summary,
      startedAt,
      completedAt,
      metadata: sanitizeAiQualityMetadata(body.metadata),
      createdByUserId: user.id,
      assistantSnapshotHash: assistantSnapshot.hash,
      assistantSnapshotSummary: assistantSnapshot.summary,
      testSetSnapshotHash: testSetSnapshot.hash,
      testSetSnapshotSummary: testSetSnapshot.summary,
      results: evaluation.results,
    });

    await auditWrite({
      user,
      context,
      workspaceId: selectedWorkspaceId,
      action: 'ai_quality_evaluation_run_created',
      entity: 'ai_quality_evaluation_run',
      entityId: run.id,
      metadata: {
        assistantId,
        testSetId: testSet.id,
        mode: 'deterministic',
        totalCases: evaluation.summary.totalCases,
        passedCases: evaluation.summary.passedCases,
        failedCases: evaluation.summary.failedCases,
        scoreBasisPoints: evaluation.summary.scoreBasisPoints,
        assistantSnapshotHash: assistantSnapshot.hash,
        testSetSnapshotHash: testSetSnapshot.hash,
      },
    });

    return mapAiQualityEvaluationRunWithResults(run);
  },
};
