import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import { evaluateAiQualityTestCase } from './ai-quality-evaluator.service';
import {
  mapAiQualityEvaluationResult,
  mapAiQualityEvaluationRunDetail,
  mapAiQualityEvaluationRunList,
  mapAiQualityTestCaseDetail,
  mapAiQualityTestCaseEvaluation,
  mapAiQualityTestCaseList,
  mapAiQualityTestSetDetail,
  mapAiQualityTestSetList,
} from './ai-quality.mapper';
import { aiQualityRepository } from './ai-quality.repository';
import type {
  AiQualityEvaluateTestCaseBody,
  AiQualityEvaluationResultsQuery,
  AiQualityEvaluationRunsQuery,
  AiQualityTestCasesQuery,
  AiQualityTestSetsQuery,
} from './ai-quality.schema';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function assertWorkspaceFilter(user: AuthenticatedUser, workspaceId: string | undefined) {
  if (!workspaceId) return;
  if (!userWorkspaceIds(user).includes(workspaceId)) {
    throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
  }
}

export const aiQualityService = {
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
};
