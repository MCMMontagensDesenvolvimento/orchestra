import { isApiError } from '@/services/api/api-error';
import { HttpStatus } from '@/services/api/http-status';

export function llmPolicySaveErrorDescription(error: unknown) {
  if (!isApiError(error)) return 'A alteracao foi bloqueada ou falhou. Tente novamente em instantes.';
  if (error.status === HttpStatus.UNAUTHORIZED) return 'Sessao expirada. Entre novamente e tente salvar a policy.';
  if (error.status === HttpStatus.FORBIDDEN) return 'Seu usuario nao tem permissao para editar a policy LLM deste assistant.';
  if (error.status === HttpStatus.TOO_MANY_REQUESTS) return 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.';
  if (error.status === HttpStatus.UNPROCESSABLE || error.status === HttpStatus.CONFLICT) {
    return 'O backend recusou a combinacao de policy. Revise allowlist, default provider e sandbox.';
  }
  if (error.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return 'O backend ficou indisponivel ao salvar. Nenhum segredo foi exibido.';
  }
  return 'Nao foi possivel salvar a policy LLM. Revise as permissoes e tente novamente.';
}
