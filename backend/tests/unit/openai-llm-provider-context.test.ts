import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env';
import { openAiRealLlmProvider } from '../../src/modules/llm/providers/openai-llm-provider';

const fakeOpenAiKey = ['unit', 'test', 'key'].join('-');

const originalEnv = {
  LLM_PROVIDERS_ENABLED: env.LLM_PROVIDERS_ENABLED,
  LLM_EXECUTION_ENABLED: env.LLM_EXECUTION_ENABLED,
  LLM_PROVIDER_TIMEOUT_MS: env.LLM_PROVIDER_TIMEOUT_MS,
  OPENAI_ENABLED: env.OPENAI_ENABLED,
  OPENAI_EXECUTION_ENABLED: env.OPENAI_EXECUTION_ENABLED,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  OPENAI_BASE_URL: env.OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL: env.OPENAI_DEFAULT_MODEL,
};

describe('OpenAI governed conversation context adapter', () => {
  beforeEach(() => {
    Object.assign(env, {
      LLM_PROVIDERS_ENABLED: true,
      LLM_EXECUTION_ENABLED: true,
      LLM_PROVIDER_TIMEOUT_MS: 15000,
      OPENAI_ENABLED: true,
      OPENAI_EXECUTION_ENABLED: true,
      OPENAI_API_KEY: fakeOpenAiKey,
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_DEFAULT_MODEL: 'gpt-governed-context',
    });
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
    vi.unstubAllGlobals();
  });

  it('sends previous governed messages separately from the current input without internal message ids', async () => {
    const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];

    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as Record<string, unknown>
        : undefined;

      calls.push({ url, init, body });

      return new Response(JSON.stringify({
        id: 'resp-context-test',
        model: 'gpt-governed-context',
        output_text: 'Resposta governada do provider externo.',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      }), { status: 200 });
    }));

    const previousUser = 'Primeira fala governada.';
    const previousAssistant = 'Resposta anterior governada.';

    const result = await openAiRealLlmProvider.generateText({
      requestId: 'req-openai-context',
      traceId: 'trace-openai-context',
      runId: 'run-openai-context',
      provider: 'openai',
      model: 'gpt-governed-context',
      input: {
        hash: 'input-hash-openai-context',
        preview: 'Mensagem atual separada.',
        raw: 'Mensagem atual separada.',
      },
      prompt: {
        instructionsPreview: 'Use apenas contexto governado.',
        instructionChars: 31,
        modelProvider: 'openai',
        modelName: 'gpt-governed-context',
        temperature: 0.1,
      },
      context: {
        assistantName: 'Provider Context Assistant',
        executionMode: 'published',
        ragReady: false,
        ragSourceCount: 0,
        mcpToolDescriptorCount: 0,
      },
      conversationContext: {
        messages: [
          { role: 'user', content: previousUser },
          { role: 'assistant', content: previousAssistant },
        ],
        summary: {
          included: true,
          messageCount: 2,
          totalChars: previousUser.length + previousAssistant.length,
          truncated: false,
          maxMessages: 12,
          maxMessageChars: 1200,
          maxTotalChars: 6000,
        },
      },
    });

    expect(result.status).toBe('completed');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.openai.com/v1/responses');
    expect(calls[0].body).toEqual(expect.objectContaining({
      model: 'gpt-governed-context',
      tool_choice: 'none',
      store: false,
      stream: false,
    }));

    const input = calls[0].body?.input as Array<{
      role: string;
      content: Array<{ type: string; text: string }>;
    }>;

    expect(input.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user']);

    expect(input[0].content[0].type).toBe('input_text');

    expect(input[1].content[0]).toEqual({
      type: 'input_text',
      text: previousUser,
    });

    expect(input[2].content[0]).toEqual({
      type: 'output_text',
      text: previousAssistant,
    });

    expect(input[3].content[0]).toEqual({
      type: 'input_text',
      text: 'Mensagem atual separada.',
    });

    expect(JSON.stringify(calls[0].body)).not.toMatch(/messageId|message-previous|createdAt|Authorization|apiKey|secret|token/);

    expect(result.metadata).toEqual(expect.objectContaining({
      externalProviderCalled: true,
      storedRawPrompt: false,
      storedRawOutput: false,
      conversationContextIncluded: true,
      conversationContextMessageCount: 2,
      conversationContextChars: previousUser.length + previousAssistant.length,
      conversationContextTruncated: false,
    }));
  });
});
