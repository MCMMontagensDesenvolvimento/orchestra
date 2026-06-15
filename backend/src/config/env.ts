import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .string()
    .default(defaultValue)
    .transform((value) => value === 'true');

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
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_ALLOWED_DOMAINS: z.string().optional(),
  MICROSOFT_POST_LOGOUT_REDIRECT_URI: z.string().url().optional(),
  RUNTIME_PROVIDER: z.enum(['local', 'agno_stub', 'agno']).default('local'),
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
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
