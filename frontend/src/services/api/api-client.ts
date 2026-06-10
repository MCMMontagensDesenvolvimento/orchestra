import axios, { AxiosError, type AxiosInstance } from 'axios';
import { env } from '@/lib/env';
import { ApiError } from './api-error';

export interface ApiEnvelope<T> {
  data: T;
  requestId?: string;
}

export interface PaginatedApiEnvelope<T> extends ApiEnvelope<T[]> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

interface StructuredErrorBody {
  message?: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  fieldErrors?: Array<{ field: string; message: string }>;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError<StructuredErrorBody>) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const message =
      data?.message ??
      error.message ??
      'Erro inesperado ao comunicar com o servidor.';

    return Promise.reject(
      new ApiError(message, status, data?.code, data?.details, data?.requestId, data?.fieldErrors),
    );
  },
);
