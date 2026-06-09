import { HttpStatus, type HttpStatusCode } from './http-status';

/**
 * Erro normalizado para toda a camada de dados (mock ou real).
 * Permite que hooks/UI tratem cenários (forbidden, empty, network, etc.)
 * sem precisar diferenciar entre axios e mocks.
 */
export class ApiError extends Error {
  status: HttpStatusCode | number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: HttpStatusCode | number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static forbidden(message = 'Acesso negado') { return new ApiError(message, HttpStatus.FORBIDDEN, 'FORBIDDEN'); }
  static notFound(message = 'Recurso não encontrado') { return new ApiError(message, HttpStatus.NOT_FOUND, 'NOT_FOUND'); }
  static server(message = 'Erro interno do servidor') { return new ApiError(message, HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL'); }
  static unauthorized(message = 'Sessão expirada') { return new ApiError(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'); }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
