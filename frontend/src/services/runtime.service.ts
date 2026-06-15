import type { RuntimeCapabilities, RuntimeConfig, RuntimeHealth, RuntimeProviderSummary } from '@/types';
import { env } from '@/lib/env';
import { mockResponse } from '@/services/mocks/mock-utils';
import { apiClient, type ApiEnvelope } from './api/api-client';
import { endpoints } from './api/endpoints';

const nowIso = () => new Date().toISOString();

const mockLocalCapabilities: RuntimeCapabilities = {
  provider: 'local',
  status: 'healthy',
  supportsTextGeneration: 'simulated',
  supportsStreaming: false,
  supportsRagContext: true,
  supportsMcpTools: true,
  supportsToolCalling: 'simulated',
  supportsSandbox: true,
  supportsExternalProviders: false,
  supportsCitations: true,
  supportsTraceEvents: true,
  maxInputPreviewChars: 500,
  maxOutputPreviewChars: 800,
};

const mockAgnoCapabilities: RuntimeCapabilities = {
  provider: 'agno_stub',
  status: 'disabled',
  supportsTextGeneration: 'planned',
  supportsStreaming: 'planned',
  supportsRagContext: 'planned',
  supportsMcpTools: 'planned',
  supportsToolCalling: 'planned',
  supportsSandbox: 'planned',
  supportsExternalProviders: false,
  supportsCitations: 'planned',
  supportsTraceEvents: 'planned',
  maxInputPreviewChars: 500,
  maxOutputPreviewChars: 800,
};

const mockAgnoLocalCapabilities: RuntimeCapabilities = {
  provider: 'agno',
  status: 'disabled',
  supportsTextGeneration: false,
  supportsStreaming: false,
  supportsRagContext: false,
  supportsMcpTools: false,
  supportsToolCalling: false,
  supportsSandbox: false,
  supportsExternalProviders: false,
  supportsCitations: false,
  supportsTraceEvents: false,
  maxInputPreviewChars: 500,
  maxOutputPreviewChars: 800,
};

const mockHealth: RuntimeHealth = {
  provider: 'local',
  status: 'healthy',
  message: 'Local deterministic runtime adapter is available.',
  checkedAt: nowIso(),
  details: {
    externalProvidersCalled: false,
    externalMcpCalled: false,
  },
};

const mockConfig: RuntimeConfig = {
  provider: 'local',
  adapterEnabled: true,
  defaultTimeoutMs: 15000,
  requestTimeoutMs: 15000,
  requirePrecheck: true,
  allowProviderFallback: false,
  externalToolsAllowed: false,
  agnoEnabled: false,
  agnoConfigured: false,
  agnoExecutionEnabled: false,
  agnoHealthcheckEnabled: false,
  agnoBaseUrlConfigured: false,
  agnoApiKeyConfigured: false,
  agnoRequireSandbox: true,
  agnoAllowExternalTools: false,
  agnoAllowRemoteMcp: false,
  agnoSendRagContext: true,
  agnoSendMcpToolDescriptors: true,
  agnoMaxInputPreviewChars: 500,
  agnoMaxOutputPreviewChars: 800,
};

const mockProviders = (): RuntimeProviderSummary[] => [
  {
    provider: 'local',
    current: true,
    health: mockHealth,
    capabilities: mockLocalCapabilities,
  },
  {
    provider: 'agno_stub',
    current: false,
    health: {
      provider: 'agno_stub',
      status: 'disabled',
      message: 'Agno adapter is disabled by configuration.',
      checkedAt: nowIso(),
      details: { realAgnoCalled: false },
    },
    capabilities: mockAgnoCapabilities,
  },
  {
    provider: 'agno',
    current: false,
    health: {
      provider: 'agno',
      status: 'disabled',
      message: 'Agno local runtime adapter is disabled by configuration.',
      checkedAt: nowIso(),
      details: { httpCalled: false },
    },
    capabilities: mockAgnoLocalCapabilities,
  },
];

export const runtimeService = {
  async providers(): Promise<RuntimeProviderSummary[]> {
    if (env.useMocks) return mockResponse(mockProviders());
    const response = await apiClient.get<ApiEnvelope<RuntimeProviderSummary[]>>(endpoints.runtime.providers);
    return response.data.data;
  },

  async capabilities(): Promise<RuntimeCapabilities> {
    if (env.useMocks) return mockResponse(mockLocalCapabilities);
    const response = await apiClient.get<ApiEnvelope<RuntimeCapabilities>>(endpoints.runtime.capabilities);
    return response.data.data;
  },

  async health(): Promise<RuntimeHealth> {
    if (env.useMocks) return mockResponse({ ...mockHealth, checkedAt: nowIso() });
    const response = await apiClient.get<ApiEnvelope<RuntimeHealth>>(endpoints.runtime.health);
    return response.data.data;
  },

  async config(): Promise<RuntimeConfig> {
    if (env.useMocks) return mockResponse(mockConfig);
    const response = await apiClient.get<ApiEnvelope<RuntimeConfig>>(endpoints.runtime.config);
    return response.data.data;
  },
};
