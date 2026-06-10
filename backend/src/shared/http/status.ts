export const httpStatus = {
  ok: 200,
  created: 201,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  validationError: 422,
  tooManyRequests: 429,
  internalError: 500,
  serviceUnavailable: 503,
} as const;
