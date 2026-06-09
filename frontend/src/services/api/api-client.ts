import axios, { AxiosError, type AxiosInstance } from 'axios';
import { env } from '@/lib/env';
import { ApiError } from './api-error';

/**
 * API client base (axios).
 *
 * Estado atual (Fase 2): existe e está configurado, mas nenhum service real
 * o utiliza enquanto VITE_USE_MOCKS=true. Quando os mocks forem desligados,
 * os services passarão a chamar este client diretamente.
 *
 * Não inclua secrets/tokens hardcoded aqui. O token de sessão deve ser
 * injetado em runtime via setAuthToken() após o login.
 */
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.set('Authorization', `Bearer ${authToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ message?: string; code?: string; details?: unknown }>) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;
    const message =
      data?.message ??
      error.message ??
      'Erro inesperado ao comunicar com o servidor.';
    return Promise.reject(new ApiError(message, status, data?.code, data?.details));
  },
);
