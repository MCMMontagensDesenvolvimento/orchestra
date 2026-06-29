import { env } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { paginationMeta } from '../../shared/validation/pagination';
import {
  mapAiObservabilityAlertEvaluation,
  mapAiObservabilityAlertRuleDetail,
  mapAiObservabilityAlertRuleList,
  mapAiUsageEventDetail,
  mapAiUsageEventList,
  mapAiUsageLimitEvaluation,
  mapAiUsageLimitPolicy,
  mapAiUsageSummary,
} from './ai-observability-admin.mapper';
import { aiObservabilityAdminRepository } from './ai-observability-admin.repository';
import type {
  AiObservabilityAlertEvaluationBody,
  AiObservabilityAlertRulesQuery,
  AiUsageEventsQuery,
  AiUsageLimitEvaluationBody,
  AiUsageLimitPoliciesQuery,
  AiUsageSummaryQuery,
} from './ai-observability-admin.schema';
import { evaluateAiObservabilityAlerts } from './ai-observability-alerts.service';
import { evaluateAiUsageLimits } from './ai-usage-limits.service';

const userWorkspaceIds = (user: AuthenticatedUser) => user.workspaces.map((workspace) => workspace.id);

function assertWorkspaceFilter(user: AuthenticatedUser, workspaceId: string | undefined) {
  if (!workspaceId) return;
  if (!userWorkspaceIds(user).includes(workspaceId)) {
    throw new AppError(403, 'WORKSPACE_FORBIDDEN', 'Workspace fora do escopo do usuario.');
  }
}

export const aiObservabilityAdminService = {
  async listUsageEvents(user: AuthenticatedUser, query: AiUsageEventsQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiObservabilityAdminRepository.listUsageEvents(
      user.tenant.id,
      userWorkspaceIds(user),
      query,
    );
    return {
      data: result.data.map(mapAiUsageEventList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getUsageEvent(id: string, user: AuthenticatedUser) {
    const event = await aiObservabilityAdminRepository.findUsageEvent(
      id,
      user.tenant.id,
      userWorkspaceIds(user),
    );
    if (!event) {
      throw new AppError(404, 'AI_USAGE_EVENT_NOT_FOUND', 'Evento de uso de IA nao encontrado.');
    }
    return mapAiUsageEventDetail(event);
  },

  async summarizeUsage(user: AuthenticatedUser, query: AiUsageSummaryQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const data = await aiObservabilityAdminRepository.summarizeUsage(
      user.tenant.id,
      userWorkspaceIds(user),
      query,
    );
    return {
      groupBy: query.groupBy,
      data: data.map((row) => mapAiUsageSummary(row, query.groupBy)),
    };
  },

  async listLimitPolicies(user: AuthenticatedUser, query: AiUsageLimitPoliciesQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiObservabilityAdminRepository.listLimitPolicies(
      user.tenant.id,
      userWorkspaceIds(user),
      query,
    );
    return {
      data: result.data.map(mapAiUsageLimitPolicy),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getLimitPolicy(id: string, user: AuthenticatedUser) {
    const policy = await aiObservabilityAdminRepository.findLimitPolicy(
      id,
      user.tenant.id,
      userWorkspaceIds(user),
    );
    if (!policy) {
      throw new AppError(404, 'AI_USAGE_LIMIT_POLICY_NOT_FOUND', 'Policy de limite de IA nao encontrada.');
    }
    return mapAiUsageLimitPolicy(policy);
  },

  async listAlertRules(user: AuthenticatedUser, query: AiObservabilityAlertRulesQuery) {
    assertWorkspaceFilter(user, query.workspaceId);
    const result = await aiObservabilityAdminRepository.listAlertRules(
      user.tenant.id,
      userWorkspaceIds(user),
      query,
    );
    return {
      data: result.data.map(mapAiObservabilityAlertRuleList),
      pagination: paginationMeta(query, result.total),
    };
  },

  async getAlertRule(id: string, user: AuthenticatedUser) {
    const rule = await aiObservabilityAdminRepository.findAlertRule(
      id,
      user.tenant.id,
      userWorkspaceIds(user),
    );
    if (!rule) {
      throw new AppError(404, 'AI_OBSERVABILITY_ALERT_RULE_NOT_FOUND', 'Regra de alerta de observabilidade de IA nao encontrada.');
    }
    return mapAiObservabilityAlertRuleDetail(rule);
  },

  async evaluateLimits(user: AuthenticatedUser, body: AiUsageLimitEvaluationBody) {
    assertWorkspaceFilter(user, body.workspaceId);
    if (body.now && env.NODE_ENV === 'production') {
      throw new AppError(422, 'AI_USAGE_LIMIT_NOW_FORBIDDEN', 'now nao pode ser informado em producao.');
    }
    const contextAccessible = await aiObservabilityAdminRepository.isEvaluationContextAccessible({
      tenantId: user.tenant.id,
      workspaceId: body.workspaceId,
      assistantId: body.assistantId,
      userId: body.userId,
    });
    if (!contextAccessible) {
      throw new AppError(404, 'AI_USAGE_CONTEXT_NOT_FOUND', 'Contexto de avaliacao de IA nao encontrado.');
    }
    const evaluation = await evaluateAiUsageLimits({
      tenantId: user.tenant.id,
      workspaceId: body.workspaceId,
      assistantId: body.assistantId,
      userId: body.userId,
      source: body.source,
      operation: body.operation,
      provider: body.provider,
      model: body.model,
      now: body.now,
      projectedUsage: body.projectedUsage,
    });
    return mapAiUsageLimitEvaluation(evaluation);
  },

  async evaluateAlerts(user: AuthenticatedUser, body: AiObservabilityAlertEvaluationBody) {
    assertWorkspaceFilter(user, body.workspaceId);
    if (body.now && env.NODE_ENV === 'production') {
      throw new AppError(422, 'AI_OBSERVABILITY_ALERT_NOW_FORBIDDEN', 'now nao pode ser informado em producao.');
    }
    const contextAccessible = await aiObservabilityAdminRepository.isEvaluationContextAccessible({
      tenantId: user.tenant.id,
      workspaceId: body.workspaceId,
      assistantId: body.assistantId,
      userId: body.userId,
    });
    if (!contextAccessible) {
      throw new AppError(404, 'AI_USAGE_CONTEXT_NOT_FOUND', 'Contexto de avaliacao de IA nao encontrado.');
    }
    const evaluation = await evaluateAiObservabilityAlerts({
      tenantId: user.tenant.id,
      workspaceId: body.workspaceId,
      assistantId: body.assistantId,
      userId: body.userId,
      source: body.source,
      operation: body.operation,
      provider: body.provider,
      model: body.model,
      now: body.now,
      projectedUsage: body.projectedUsage,
    });
    return mapAiObservabilityAlertEvaluation(evaluation);
  },
};
