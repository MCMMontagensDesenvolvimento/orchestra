import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/app-error';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { recordAuditEvent } from '../audit/audit.service';
import type { RequestContext } from '../agent-runs/agent-runs.types';
import { getLlmConfig } from './llm.config';
import { llmProviderRegistry } from './llm.registry';
import type { LlmGenerateTextRequest, LlmProviderName } from './llm.types';
import type { LlmTestGenerationInput } from './llm.schema';

const unsafeMetadataKeys = new Set(['authorization', 'apikey', 'api_key', 'content', 'credential', 'input', 'output', 'password', 'prompt', 'secret', 'text', 'token']);

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function previewText(value: string, maxChars: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 300);
  if (depth >= 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, item]) => {
      const normalized = key.toLowerCase();
      return [key, unsafeMetadataKeys.has(normalized) ? '[redacted]' : sanitizeMetadata(item, depth + 1)];
    }),
  );
}

async function recordLlmAudit(input: {
  action: string;
  user?: AuthenticatedUser;
  context?: RequestContext;
  provider?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.user) return;
  await recordAuditEvent({
    tenantId: input.user.tenant.id,
    actorUserId: input.user.id,
    action: input.action,
    entity: 'llm_provider',
    entityId: input.provider,
    metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue,
    requestId: input.context?.requestId,
    ipAddress: input.context?.ipAddress,
    userAgent: input.context?.userAgent,
  });
}

export const llmService = {
  config() {
    return getLlmConfig();
  },

  async providers(user?: AuthenticatedUser, context?: RequestContext) {
    const providers = await llmProviderRegistry.listProviders();
    await recordLlmAudit({
      action: 'llm_providers_listed',
      user,
      context,
      metadata: {
        providerCount: providers.length,
        currentProvider: llmProviderRegistry.currentProvider(),
      },
    });
    return providers;
  },

  async provider(provider: LlmProviderName, user?: AuthenticatedUser, context?: RequestContext) {
    const adapter = llmProviderRegistry.get(provider);
    const [health, capabilities] = await Promise.all([adapter.healthCheck(), adapter.getCapabilities()]);
    await recordLlmAudit({
      action: 'llm_provider_read',
      user,
      context,
      provider,
      metadata: {
        status: health.status,
      },
    });
    return {
      provider,
      current: provider === llmProviderRegistry.currentProvider(),
      health,
      capabilities,
    };
  },

  async health(provider: LlmProviderName, user?: AuthenticatedUser, context?: RequestContext) {
    const health = await llmProviderRegistry.get(provider).healthCheck();
    await recordLlmAudit({
      action: 'llm_provider_health_checked',
      user,
      context,
      provider,
      metadata: {
        status: health.status,
      },
    });
    return health;
  },

  async capabilities(provider: LlmProviderName, user?: AuthenticatedUser, context?: RequestContext) {
    const capabilities = llmProviderRegistry.get(provider).getCapabilities();
    await recordLlmAudit({
      action: 'llm_provider_capabilities_read',
      user,
      context,
      provider,
      metadata: {
        status: capabilities.status,
      },
    });
    return capabilities;
  },

  async testGeneration(input: LlmTestGenerationInput, user: AuthenticatedUser, context: RequestContext) {
    const config = getLlmConfig();
    const inputPreview = previewText(input.input, config.maxInputPreviewChars);
    const inputHash = hashText(input.input);
    const provider = llmProviderRegistry.get(input.provider);
    const result = await provider.generateText({
      requestId: context.requestId,
      provider: input.provider,
      input: {
        hash: inputHash,
        preview: inputPreview,
        raw: input.input,
      },
      model: input.model,
      context: {
        assistantName: 'llm-test-generation',
        executionMode: 'test_generation',
        ragReady: false,
        ragSourceCount: 0,
        mcpToolDescriptorCount: 0,
      },
      metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue,
    });

    await recordLlmAudit({
      action: result.status === 'completed' ? 'llm_test_generation_completed' : 'llm_test_generation_blocked',
      user,
      context,
      provider: input.provider,
      metadata: {
        status: result.status,
        inputHash,
        inputPreviewChars: inputPreview.length,
        outputHash: result.outputHash,
        outputPreview: result.outputPreview,
        errorCode: result.errorCode,
        externalProviderCalled:
          typeof result.metadata === 'object'
          && result.metadata !== null
          && 'externalProviderCalled' in result.metadata
            ? Boolean((result.metadata as Record<string, unknown>).externalProviderCalled)
            : false,
      },
    });

    if (result.status !== 'completed') {
      throw new AppError(409, result.errorCode ?? 'LLM_PROVIDER_BLOCKED', result.errorMessage ?? result.message);
    }
    return result;
  },

  async generateForRuntime(request: LlmGenerateTextRequest) {
    const provider = llmProviderRegistry.get(request.provider);
    return provider.generateText(request);
  },
};
