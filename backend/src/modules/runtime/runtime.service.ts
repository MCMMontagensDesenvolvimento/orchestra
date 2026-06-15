import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { recordAuditEvent } from '../audit/audit.service';
import type { RequestContext } from '../agent-runs/agent-runs.types';
import { getRuntimeConfig } from './runtime.config';
import { runtimeAdapterRegistry } from './runtime.registry';
import type { RuntimeExecutionContext } from './runtime.types';

async function recordRuntimeAudit(input: {
  action: string;
  user?: AuthenticatedUser;
  context?: RequestContext;
  entityId?: string;
  workspaceId?: string;
    metadata?: Record<string, unknown>;
}) {
  if (!input.user) return;
  await recordAuditEvent({
    tenantId: input.user.tenant.id,
    workspaceId: input.workspaceId,
    actorUserId: input.user.id,
    action: input.action,
    entity: 'runtime',
    entityId: input.entityId,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
    requestId: input.context?.requestId,
    ipAddress: input.context?.ipAddress,
    userAgent: input.context?.userAgent,
  });
}

export const runtimeService = {
  async providers(user?: AuthenticatedUser, context?: RequestContext) {
    const providers = await runtimeAdapterRegistry.listProviders();
    await recordRuntimeAudit({
      action: 'runtime_health_checked',
      user,
      context,
      metadata: {
        providerCount: providers.length,
        currentProvider: runtimeAdapterRegistry.currentProvider(),
      },
    });
    if (providers.some((provider) => provider.provider === 'agno_stub')) {
      await recordRuntimeAudit({
        action: 'agno_adapter_readiness_checked',
        user,
        context,
        metadata: {
          agnoEnabled: getRuntimeConfig().agnoEnabled,
          agnoConfigured: getRuntimeConfig().agnoConfigured,
        },
      });
    }
    return providers;
  },

  async capabilities(user?: AuthenticatedUser, context?: RequestContext) {
    const adapter = runtimeAdapterRegistry.get();
    const capabilities = await adapter.getCapabilities();
    await recordRuntimeAudit({
      action: 'runtime_health_checked',
      user,
      context,
      metadata: {
        provider: adapter.provider,
        capabilityStatus: capabilities.status,
      },
    });
    return capabilities;
  },

  async health(user?: AuthenticatedUser, context?: RequestContext) {
    const adapter = runtimeAdapterRegistry.get();
    const health = await adapter.healthCheck();
    await recordRuntimeAudit({
      action: health.status === 'misconfigured' ? 'runtime_adapter_misconfigured' : 'runtime_health_checked',
      user,
      context,
      metadata: {
        provider: adapter.provider,
        status: health.status,
      },
    });
    return health;
  },

  config() {
    return getRuntimeConfig();
  },

  async execute(context: RuntimeExecutionContext) {
    const adapter = runtimeAdapterRegistry.get(context.provider);
    return adapter.execute(context);
  },

  async cancel(input: { runId: string; traceId: string }) {
    const adapter = runtimeAdapterRegistry.get();
    if (adapter.cancel) return adapter.cancel(input);
    return {
      provider: adapter.provider,
      status: 'cancelled' as const,
      message: 'Cancelamento registrado pelo control plane sem adapter externo.',
      events: [
        {
          type: 'adapter_warning' as const,
          status: 'cancelled' as const,
          message: 'Adapter atual nao possui cancelamento dedicado.',
          metadata: { provider: adapter.provider, runId: input.runId, traceId: input.traceId },
        },
      ],
    };
  },
};
