import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api/api-error';
import { llmPolicySaveErrorDescription } from '@/lib/llm-policy-errors';

describe('LLM policy safe error messages', () => {
  it.each([
    [401, 'Sessao expirada. Entre novamente e tente salvar a policy.'],
    [403, 'Seu usuario nao tem permissao para editar a policy LLM deste assistant.'],
    [409, 'O backend recusou a combinacao de policy. Revise allowlist, default provider e sandbox.'],
    [422, 'O backend recusou a combinacao de policy. Revise allowlist, default provider e sandbox.'],
    [429, 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.'],
    [500, 'O backend ficou indisponivel ao salvar. Nenhum segredo foi exibido.'],
    [502, 'O backend ficou indisponivel ao salvar. Nenhum segredo foi exibido.'],
    [503, 'O backend ficou indisponivel ao salvar. Nenhum segredo foi exibido.'],
  ])('maps HTTP %s without exposing the backend message', (status, expected) => {
    const error = new ApiError(
      'Upstream response with Authorization Bearer secret and raw prompt.',
      status,
      'INTERNAL_UPSTREAM_ERROR',
      { output: 'raw output' },
    );

    const description = llmPolicySaveErrorDescription(error);
    expect(description).toBe(expected);
    expect(description).not.toContain(error.message);
    expect(description.toLowerCase()).not.toContain('authorization');
    expect(description.toLowerCase()).not.toContain('raw prompt');
    expect(description.toLowerCase()).not.toContain('raw output');
  });

  it('uses a generic safe message for non-API failures', () => {
    expect(llmPolicySaveErrorDescription(new Error('Network secret detail'))).toBe(
      'A alteracao foi bloqueada ou falhou. Tente novamente em instantes.',
    );
  });
});
