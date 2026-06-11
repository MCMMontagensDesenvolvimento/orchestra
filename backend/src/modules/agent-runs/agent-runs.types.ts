import type { Prisma } from '@prisma/client';
import type { AgentRunMode, AgentRunStatus } from './agent-runs.schema';

export interface RequestContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PrecheckReason {
  code: string;
  message: string;
}

export interface AgentRunPrecheckSnapshot {
  canExecute: boolean;
  mode: AgentRunMode;
  reasons: PrecheckReason[];
  requestId: string;
}

export interface AgentRunEventInput {
  type: string;
  status?: AgentRunStatus | string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface RuntimeStartInput {
  runId: string;
  traceId: string;
  assistantId: string;
  assistantVersionId?: string | null;
  assistantPublicationId?: string | null;
  mode: AgentRunMode;
}

export interface RuntimeStartResult {
  status: 'completed' | 'failed';
  message: string;
  events: AgentRunEventInput[];
  errorCode?: string;
  errorMessage?: string;
}
