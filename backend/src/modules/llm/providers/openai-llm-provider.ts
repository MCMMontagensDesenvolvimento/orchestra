import { createHash } from 'node:crypto';
import { env } from '../../../config/env';
import { getLlmConfig } from '../llm.config';
import type { LlmGenerateTextRequest, LlmGenerateTextResult, LlmProvider, LlmProviderCapabilities, LlmProviderHealth, LlmProviderName, LlmProviderStatus } from '../llm.types';

const provider: LlmProviderName = 'openai';

type OpenAiErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string | null;
  };
};

type OpenAiResponseBody = {
  id?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

type OpenAiInputMessage = {
  role: 'system' | 'user' | 'assistant';
  content: Array<{
    type: 'input_text' | 'output_text';
    text: string;
  }>;
};

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function previewText(value: string, maxChars: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function nowIso() {
  return new Date().toISOString();
}

function openAiStatus(): {
  status: LlmProviderStatus;
  message: string;
} {
  const config = getLlmConfig();

  if (!config.providersEnabled) {
    return {
      status: 'disabled',
      message: 'LLM providers are disabled by global configuration.',
    };
  }

  if (!config.openaiEnabled) {
    return {
      status: 'disabled',
      message: 'OpenAI provider is disabled by configuration.',
    };
  }

  if (!config.openaiConfigured) {
    return {
      status: 'misconfigured',
      message: 'OpenAI provider is enabled but OPENAI_API_KEY or OPENAI_DEFAULT_MODEL is missing.',
    };
  }

  if (!config.executionEnabled || !config.openaiExecutionEnabled) {
    return {
      status: 'configured_but_execution_disabled',
      message: 'OpenAI provider is configured but execution is disabled.',
    };
  }

  return {
    status: 'healthy',
    message: 'OpenAI provider is configured and execution is enabled.',
  };
}

function blockedResult(
  request: LlmGenerateTextRequest,
  status: LlmProviderStatus,
  message: string,
  errorCode: string,
): LlmGenerateTextResult {
  return {
    provider,
    status: 'blocked',
    message,
    model: request.model ?? getLlmConfig().openaiDefaultModel,
    inputHash: request.input.hash,
    latencyMs: 0,
    errorCode,
    errorMessage: message,
    metadata: {
      provider,
      providerStatus: status,
      externalProviderCalled: false,
      failedClosed: true,
      ...conversationContextMetadata(request),
    },
  };
}

function errorCodeFromHttpStatus(status: number) {
  if (status === 401) return 'OPENAI_AUTH_FAILED';
  if (status === 403) return 'OPENAI_FORBIDDEN';
  if (status === 429) return 'OPENAI_RATE_LIMITED';
  if (status >= 500) return 'OPENAI_UPSTREAM_UNAVAILABLE';
  return 'OPENAI_REQUEST_FAILED';
}

function extractOpenAiText(body: OpenAiResponseBody) {
  if (typeof body.output_text === 'string' && body.output_text.trim()) {
    return body.output_text.trim();
  }

  const parts: string[] = [];

  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join('\n').trim();
}

function conversationContextMetadata(request: LlmGenerateTextRequest) {
  return {
    conversationContextIncluded: Boolean(request.conversationContext?.summary.included),
    conversationContextMessageCount: request.conversationContext?.summary.messageCount ?? 0,
    conversationContextChars: request.conversationContext?.summary.totalChars ?? 0,
    conversationContextTruncated: Boolean(request.conversationContext?.summary.truncated),
  };
}

function buildOpenAiInput(request: LlmGenerateTextRequest) {
  const userInput = request.input.raw ?? request.input.preview;
  const systemParts = [
    'Você é um provider LLM conectado ao Orchestra.',
    'Responda de forma objetiva, segura e aderente às instruções recebidas.',
    'Não execute ferramentas externas.',
    'Não solicite nem exponha segredos.',
  ];

  if (request.prompt?.instructionsPreview) {
    systemParts.push(`Instruções do assistente: ${request.prompt.instructionsPreview}`);
  }

  if (request.context?.assistantName) {
    systemParts.push(`Assistente: ${request.context.assistantName}`);
  }

  if (request.context?.executionMode) {
    systemParts.push(`Modo de execução: ${request.context.executionMode}`);
  }

  if (request.conversationContext?.summary.included) {
    systemParts.push([
      'Contexto conversacional anterior foi anexado pelo backend do Orchestra.',
      `Mensagens: ${request.conversationContext.summary.messageCount}.`,
      `Caracteres: ${request.conversationContext.summary.totalChars}.`,
      `Truncado: ${request.conversationContext.summary.truncated ? 'sim' : 'nao'}.`,
    ].join(' '));
  }

  const inputMessages: OpenAiInputMessage[] = [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: systemParts.join('\n'),
        },
      ],
    },
  ];

  for (const message of request.conversationContext?.messages ?? []) {
    inputMessages.push({
      role: message.role,
      content: [
        {
          type: message.role === 'assistant' ? 'output_text' : 'input_text',
          text: message.content,
        },
      ],
    });
  }

  inputMessages.push({
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: userInput,
      },
    ],
  });

  return inputMessages;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export const openAiRealLlmProvider: LlmProvider = {
  provider,

  getCapabilities(): LlmProviderCapabilities {
    const config = getLlmConfig();
    const status = openAiStatus();

    return {
      provider,
      status: status.status,
      enabled: config.openaiEnabled,
      configured: config.openaiConfigured,
      executionEnabled: config.executionEnabled && config.openaiExecutionEnabled,
      supportsChatCompletion: status.status === 'healthy',
      supportsStreaming: 'planned_but_disabled',
      supportsToolCalling: 'planned_but_disabled',
      supportsStructuredOutput: 'planned_but_disabled',
      supportsEmbeddings: 'planned_but_disabled',
      supportsRagContext: true,
      supportsMcpContext: true,
      secretsConfigured: Boolean(env.OPENAI_API_KEY),
      models: config.openaiDefaultModel ? [config.openaiDefaultModel] : [],
      defaultModel: config.openaiDefaultModel,
      maxInputPreviewChars: config.maxInputPreviewChars,
      maxOutputPreviewChars: config.maxOutputPreviewChars,
    };
  },

  async healthCheck(): Promise<LlmProviderHealth> {
    const config = getLlmConfig();
    const status = openAiStatus();

    return {
      provider,
      status: status.status,
      message: status.message,
      checkedAt: nowIso(),
      details: {
        providersEnabled: config.providersEnabled,
        openaiEnabled: config.openaiEnabled,
        openaiConfigured: config.openaiConfigured,
        executionEnabled: config.executionEnabled,
        openaiExecutionEnabled: config.openaiExecutionEnabled,
        baseUrlConfigured: config.openaiBaseUrlConfigured,
        apiKeyConfigured: Boolean(env.OPENAI_API_KEY),
        defaultModelConfigured: Boolean(config.openaiDefaultModel),
        externalProviderCalled: false,
      },
    };
  },

  async generateText(request: LlmGenerateTextRequest): Promise<LlmGenerateTextResult> {
    const config = getLlmConfig();
    const status = openAiStatus();

    if (status.status !== 'healthy') {
      const errorCode =
        status.status === 'misconfigured'
          ? 'OPENAI_PROVIDER_MISCONFIGURED'
          : 'LLM_PROVIDER_EXECUTION_BLOCKED';

      return blockedResult(
        request,
        status.status,
        status.message,
        errorCode,
      );
    }

    const model = request.model ?? config.openaiDefaultModel;

    if (!model) {
      return blockedResult(
        request,
        'misconfigured',
        'OpenAI model is not configured.',
        'OPENAI_MODEL_MISSING',
      );
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.providerTimeoutMs);

    try {
      const response = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: buildOpenAiInput(request),
          tool_choice: 'none',
          store: false,
          stream: false,
          temperature: request.prompt?.temperature ?? undefined,
        }),
      });

      const latencyMs = Date.now() - startedAt;
      const body = await readResponseBody(response);

      if (!response.ok) {
        const error = body as OpenAiErrorBody;
        const message = error.error?.message ?? `OpenAI request failed with status ${response.status}.`;

        return {
          provider,
          status: 'failed',
          message: 'OpenAI generation failed.',
          model,
          inputHash: request.input.hash,
          latencyMs,
          errorCode: errorCodeFromHttpStatus(response.status),
          errorMessage: message.slice(0, 500),
          metadata: {
            provider,
            httpStatus: response.status,
            errorType: error.error?.type,
            errorCode: error.error?.code,
            externalProviderCalled: true,
            failedClosed: true,
            ...conversationContextMetadata(request),
          },
        };
      }

      const data = body as OpenAiResponseBody;
      const outputText = extractOpenAiText(data);

      if (!outputText) {
        return {
          provider,
          status: 'failed',
          message: 'OpenAI response did not contain text output.',
          model: data.model ?? model,
          inputHash: request.input.hash,
          latencyMs,
          errorCode: 'OPENAI_EMPTY_OUTPUT',
          errorMessage: 'OpenAI response did not contain output_text or message content.',
          metadata: {
            provider,
            responseId: data.id,
            externalProviderCalled: true,
            failedClosed: true,
            ...conversationContextMetadata(request),
          },
        };
      }

      const outputPreview = previewText(outputText, config.maxOutputPreviewChars);

      return {
        provider,
        status: 'completed',
        message: 'OpenAI generation completed.',
        model: data.model ?? model,
        outputPreview,
        outputHash: hashText(outputText),
        inputHash: request.input.hash,
        latencyMs,
        metadata: {
          provider,
          responseId: data.id,
          externalProviderCalled: true,
          storedRawPrompt: false,
          storedRawOutput: false,
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
          totalTokens: data.usage?.total_tokens,
          ...conversationContextMetadata(request),
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const isAbort = error instanceof Error && error.name === 'AbortError';

      return {
        provider,
        status: 'failed',
        message: isAbort ? 'OpenAI generation timed out.' : 'OpenAI generation failed unexpectedly.',
        model,
        inputHash: request.input.hash,
        latencyMs,
        errorCode: isAbort ? 'OPENAI_TIMEOUT' : 'OPENAI_UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Unknown OpenAI error.',
        metadata: {
          provider,
          externalProviderCalled: true,
          failedClosed: true,
          timeoutMs: config.providerTimeoutMs,
          ...conversationContextMetadata(request),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
