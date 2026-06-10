export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Recurso nao encontrado.') =>
  new AppError(404, 'NOT_FOUND', message);
