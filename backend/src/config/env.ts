import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .string()
    .default(defaultValue)
    .transform((value) => value === 'true');
const safePositiveInteger = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return defaultValue;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
  }, z.number().int().positive());
const optionalUrl = z.preprocess((value) => {
  const normalized = blankToUndefined(value);
  if (typeof normalized !== 'string') return undefined;
  try {
    return new URL(normalized).toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default('postgresql://orchestra:orchestra@localhost:5432/orchestra'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(8).default('change-me-in-production'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(86400),
  COOKIE_NAME: z.string().min(1).default('orchestra_session'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  LOG_LEVEL: z.string().default('debug'),
  DEV_LOGIN_ENABLED: booleanString('false'),
  MICROSOFT_SSO_ENABLED: booleanString('false'),
  MICROSOFT_CLIENT_ID: z.preprocess(blankToUndefined, z.string().trim().uuid().optional()),
  MICROSOFT_CLIENT_SECRET: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
  MICROSOFT_TENANT_ID: z.preprocess(blankToUndefined, z.string().trim().uuid().optional()),
  MICROSOFT_REDIRECT_URI: z.preprocess(blankToUndefined, z.string().url().optional()),
  MICROSOFT_ALLOWED_DOMAINS: z.preprocess(blankToUndefined, z.string().optional()),
  MICROSOFT_ALLOWED_TENANT_IDS: z.preprocess(blankToUndefined, z.string().optional()),
  MICROSOFT_POST_LOGOUT_REDIRECT_URI: z.preprocess(blankToUndefined, z.string().url().optional()),
  MICROSOFT_SSO_AUTO_LINK_BY_EMAIL: booleanString('false'),
  RUNTIME_PROVIDER: z.enum(['local', 'agno_stub', 'agno', 'agno_http']).default('local'),
  RUNTIME_ADAPTER_ENABLED: booleanString('true'),
  RUNTIME_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  RUNTIME_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  RUNTIME_REQUIRE_PRECHECK: booleanString('true'),
  RUNTIME_ALLOW_PROVIDER_FALLBACK: booleanString('false'),
  RUNTIME_ALLOW_EXTERNAL_TOOLS: booleanString('false'),
  AGNO_ENABLED: booleanString('false'),
  AGNO_EXECUTION_ENABLED: booleanString('false'),
  AGNO_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  AGNO_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AGNO_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  AGNO_HEALTHCHECK_ENABLED: booleanString('false'),
  AGNO_HEALTH_PATH: z.string().min(1).default('/health'),
  AGNO_CAPABILITIES_PATH: z.string().min(1).default('/capabilities'),
  AGNO_EXECUTE_PATH: z.string().min(1).default('/runs'),
  AGNO_REQUIRE_SANDBOX: booleanString('true'),
  AGNO_ALLOW_EXTERNAL_TOOLS: booleanString('false'),
  AGNO_ALLOW_REMOTE_MCP: booleanString('false'),
  AGNO_SEND_RAG_CONTEXT: booleanString('true'),
  AGNO_SEND_MCP_TOOL_DESCRIPTORS: booleanString('true'),
  AGNO_MAX_INPUT_PREVIEW_CHARS: z.coerce.number().int().positive().default(500),
  AGNO_MAX_OUTPUT_PREVIEW_CHARS: z.coerce.number().int().positive().default(800),
  AGNO_RUNTIME_HTTP_ENABLED: booleanString('false'),
  AGNO_RUNTIME_HTTP_BASE_URL: optionalUrl,
  AGNO_RUNTIME_HTTP_TIMEOUT_MS: safePositiveInteger(15000),
  AGNO_RUNTIME_HTTP_SECURITY_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  MCP_REMOTE_ENABLED: booleanString('false'),
  MCP_REMOTE_EXECUTION_ENABLED: booleanString('false'),
  MCP_REMOTE_DISCOVERY_ENABLED: booleanString('false'),
  MCP_REMOTE_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  LLM_PROVIDERS_ENABLED: booleanString('false'),
  LLM_DEFAULT_PROVIDER: z.enum(['local_deterministic', 'agno_local', 'openai', 'azure_openai', 'anthropic']).default('local_deterministic'),
  LLM_EXECUTION_ENABLED: booleanString('false'),
  LLM_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  LLM_MAX_INPUT_PREVIEW_CHARS: z.coerce.number().int().positive().default(500),
  LLM_MAX_OUTPUT_PREVIEW_CHARS: z.coerce.number().int().positive().default(800),
  LLM_STORE_RAW_PROMPTS: booleanString('false'),
  LLM_STORE_RAW_OUTPUTS: booleanString('false'),
  EMBEDDINGS_ENABLED: booleanString('false'),
  EMBEDDINGS_PROVIDER: z.enum(['disabled', 'openai', 'azure_openai', 'ollama', 'huggingface']).default('disabled'),
  EMBEDDINGS_EXECUTION_ENABLED: booleanString('false'),
  EMBEDDINGS_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  EMBEDDINGS_DIMENSION: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  EMBEDDINGS_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  EMBEDDINGS_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(8000),
  EMBEDDINGS_MAX_BATCH_SIZE: z.coerce.number().int().positive().default(16),
  EMBEDDINGS_STORE_RAW_INPUTS: booleanString('false'),
  EMBEDDINGS_STORE_RAW_OUTPUTS: booleanString('false'),
  OPENAI_ENABLED: booleanString('false'),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_DEFAULT_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  OPENAI_EXECUTION_ENABLED: booleanString('false'),
  AZURE_OPENAI_ENABLED: booleanString('false'),
  AZURE_OPENAI_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  AZURE_OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AZURE_OPENAI_DEPLOYMENT: z.preprocess(emptyToUndefined, z.string().optional()),
  AZURE_OPENAI_API_VERSION: z.preprocess(emptyToUndefined, z.string().optional()),
  AZURE_OPENAI_EXECUTION_ENABLED: booleanString('false'),
  ANTHROPIC_ENABLED: booleanString('false'),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  ANTHROPIC_DEFAULT_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_EXECUTION_ENABLED: booleanString('false'),
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
