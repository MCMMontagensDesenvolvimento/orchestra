import type {
  RuntimeAdapter,
  RuntimeCapabilities,
  RuntimeExecutionContext,
  RuntimeExecutionResult,
  RuntimeHealth,
  RuntimeProvider,
} from './runtime.types';
import { getRuntimeConfig } from './runtime.config';

const maxInputPreviewChars = 500;
const maxOutputPreviewChars = 800;

export class AgnoRuntimeAdapter implements RuntimeAdapter {
  readonly provider: RuntimeProvider;

  constructor(provider: RuntimeProvider = 'agno_stub') {
    this.provider = provider;
  }

  getCapabilities(): RuntimeCapabilities {
    const health = this.computeHealth();
    return {
      provider: this.provider,
      status: health.status,
      supportsTextGeneration: 'planned',
      supportsStreaming: 'planned',
      supportsRagContext: 'planned',
      supportsMcpTools: 'planned',
      supportsToolCalling: 'planned',
      supportsSandbox: 'planned',
      supportsExternalProviders: false,
      supportsCitations: 'planned',
      supportsTraceEvents: 'planned',
      maxInputPreviewChars,
      maxOutputPreviewChars,
    };
  }

  async healthCheck(): Promise<RuntimeHealth> {
    return this.computeHealth();
  }

  async execute(_context: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const health = this.computeHealth();
    return {
      provider: this.provider,
      status: 'failed',
      message: 'Agno runtime adapter is a readiness stub in this phase.',
      errorCode: health.status === 'misconfigured' ? 'AGNO_ADAPTER_MISCONFIGURED' : 'AGNO_ADAPTER_DISABLED',
      errorMessage: health.message,
      events: [
        {
          type: 'adapter_warning',
          status: 'failed',
          message: health.message,
          metadata: {
            provider: this.provider,
            healthStatus: health.status,
            realAgnoCalled: false,
          },
        },
        {
          type: 'run_failed',
          status: 'failed',
          message: 'Agno adapter stub nao executa runs nesta fase.',
          metadata: {
            provider: this.provider,
            realAgnoCalled: false,
          },
        },
      ],
    };
  }

  private computeHealth(): RuntimeHealth {
    const config = getRuntimeConfig();
    const checkedAt = new Date().toISOString();
    if (!config.agnoEnabled) {
      return {
        provider: this.provider,
        status: 'disabled',
        message: 'Agno adapter is disabled by configuration.',
        checkedAt,
        details: {
          agnoEnabled: false,
          agnoConfigured: false,
          realAgnoCalled: false,
        },
      };
    }

    if (!config.agnoConfigured) {
      return {
        provider: this.provider,
        status: 'misconfigured',
        message: 'Agno adapter is enabled but required backend configuration is incomplete.',
        checkedAt,
        details: {
          agnoEnabled: true,
          agnoConfigured: false,
          baseUrlConfigured: config.agnoBaseUrlConfigured,
          apiKeyConfigured: false,
          realAgnoCalled: false,
        },
      };
    }

    return {
      provider: this.provider,
      status: config.agnoHealthcheckEnabled ? 'degraded' : 'disabled',
      message: config.agnoHealthcheckEnabled
        ? 'Agno adapter configuration is present, but real healthcheck is intentionally not executed in this phase.'
        : 'Agno adapter configuration is present, but healthcheck execution is disabled.',
      checkedAt,
      details: {
        agnoEnabled: true,
        agnoConfigured: true,
        agnoHealthcheckEnabled: config.agnoHealthcheckEnabled,
        realAgnoCalled: false,
      },
    };
  }
}

export const agnoRuntimeAdapter = new AgnoRuntimeAdapter('agno');
export const agnoStubRuntimeAdapter = new AgnoRuntimeAdapter('agno_stub');
