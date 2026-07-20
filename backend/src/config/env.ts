import dotenv from 'dotenv';
import { z } from 'zod';
import {
  agnoRuntimeHttpTimeoutMaxMs,
  agnoRuntimeHttpTimeoutMinMs,
  normalizeAgnoRuntimeHttpBaseUrl,
  normalizeAgnoRuntimeHttpSecurityKey,
} from './agno-runtime-http-security';
import { productionJwtSecretIssue } from './production-secrets';

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
const safeNonNegativeInteger = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return defaultValue;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : defaultValue;
  }, z.number().int().nonnegative());
const agnoRuntimeHttpBaseUrl = z.preprocess(blankToUndefined, z.string().transform((value, ctx) => {
  try {
    return normalizeAgnoRuntimeHttpBaseUrl(value);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Agno runtime HTTP base URL is invalid.',
    });
    return z.NEVER;
  }
}).optional());
const agnoRuntimeHttpSecurityKey = z.preprocess(blankToUndefined, z.string().transform((value, ctx) => {
  try {
    return normalizeAgnoRuntimeHttpSecurityKey(value);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Agno runtime HTTP security key is invalid.',
    });
    return z.NEVER;
  }
}).optional());
const agnoRuntimeHttpTimeout = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(agnoRuntimeHttpTimeoutMinMs).max(agnoRuntimeHttpTimeoutMaxMs).default(15000),
);

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
  CHAT_CONTEXT_ENABLED: booleanString('true'),
  CHAT_CONTEXT_MAX_MESSAGES: safePositiveInteger(12),
  CHAT_CONTEXT_MAX_MESSAGE_CHARS: safePositiveInteger(1200),
  CHAT_CONTEXT_MAX_TOTAL_CHARS: safePositiveInteger(6000),
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
  AGNO_RUNTIME_HTTP_BASE_URL: agnoRuntimeHttpBaseUrl,
  AGNO_RUNTIME_HTTP_TIMEOUT_MS: agnoRuntimeHttpTimeout,
  AGNO_RUNTIME_HTTP_SECURITY_KEY: agnoRuntimeHttpSecurityKey,
  AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: booleanString('false'),
  AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: booleanString('false'),
  AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: safePositiveInteger(5),
  AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: safePositiveInteger(1200),
  AGNO_RUNTIME_HTTP_MAX_RAG_CONTEXT_CHARS: safePositiveInteger(6000),
  AGNO_RUNTIME_HTTP_TOOLS_ENABLED: booleanString('false'),
  AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS: safePositiveInteger(8),
  AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: safeNonNegativeInteger(0),
  AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS: safePositiveInteger(6000),
  AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: booleanString('false'),
  AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES: z.coerce.number().int().min(1024).max(32_768).default(32_768),
  MCP_REMOTE_ENABLED: booleanString('false'),
  MCP_REMOTE_EXECUTION_ENABLED: booleanString('false'),
  MCP_REMOTE_DISCOVERY_ENABLED: booleanString('false'),
  MCP_REMOTE_READONLY_ENABLED: booleanString('false'),
  MCP_REMOTE_EGRESS_ALLOWLIST: z.string().default(''),
  MCP_REMOTE_DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  MCP_REMOTE_MAX_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5000),
  MCP_REMOTE_MAX_RESPONSE_BYTES: z.coerce.number().int().min(1024).max(1_048_576).default(65_536),
  MCP_REMOTE_REQUIRE_SECRET_REF: booleanString('true'),
  MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false'),
  MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: booleanString('false'),
  MCP_REMOTE_LOCAL_DEMO_ORIGIN: z.preprocess(blankToUndefined, z.string().url().optional()),
  LLM_PROVIDERS_ENABLED: booleanString('false'),
  LLM_DEFAULT_PROVIDER: z.enum(['local_deterministic', 'agno_local', 'openai', 'azure_openai', 'anthropic']).default('local_deterministic'),
  LLM_EXECUTION_ENABLED: booleanString('false'),
  LLM_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  LLM_MAX_INPUT_PREVIEW_CHARS: z.coerce.number().int().positive().default(500),
  LLM_MAX_OUTPUT_PREVIEW_CHARS: z.coerce.number().int().positive().default(800),
  LLM_STORE_RAW_PROMPTS: booleanString('false'),
  LLM_STORE_RAW_OUTPUTS: booleanString('false'),
  EMBEDDINGS_ENABLED: booleanString('false'),
  EMBEDDINGS_PROVIDER: z.enum(['disabled', 'stub', 'openai', 'azure_openai', 'ollama', 'huggingface']).default('disabled'),
  EMBEDDINGS_EXECUTION_ENABLED: booleanString('false'),
  EMBEDDINGS_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  EMBEDDINGS_DIMENSION: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  EMBEDDINGS_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  EMBEDDINGS_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(8000),
  EMBEDDINGS_MAX_BATCH_SIZE: z.coerce.number().int().positive().default(16),
  EMBEDDINGS_STORE_RAW_INPUTS: booleanString('false'),
  EMBEDDINGS_STORE_RAW_OUTPUTS: booleanString('false'),
  KNOWLEDGE_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(10_485_760).default(1_048_576),
  KNOWLEDGE_ALLOWED_FILE_TYPES: z.string().default('txt,md,csv'),
  KNOWLEDGE_RETRIEVAL_MODE: z.enum(['keyword', 'semantic', 'hybrid']).default('hybrid'),
  KNOWLEDGE_RETRIEVAL_MAX_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  KNOWLEDGE_RETRIEVAL_MAX_EXCERPT_CHARS: z.coerce.number().int().min(100).max(4000).default(1200),
  KNOWLEDGE_RETRIEVAL_MAX_CONTEXT_CHARS: z.coerce.number().int().min(500).max(50_000).default(6000),
  KNOWLEDGE_RETRIEVAL_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0),
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
}).superRefine((value, ctx) => {
  const jwtSecretIssue = productionJwtSecretIssue(value.NODE_ENV, value.JWT_SECRET);
  if (jwtSecretIssue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: jwtSecretIssue,
    });
  }
  if (value.AGNO_RUNTIME_HTTP_ENABLED && !value.AGNO_RUNTIME_HTTP_BASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AGNO_RUNTIME_HTTP_BASE_URL'],
      message: 'AGNO_RUNTIME_HTTP_BASE_URL is required when AGNO_RUNTIME_HTTP_ENABLED=true.',
    });
  }
  if (
    value.AGNO_RUNTIME_HTTP_ENABLED
    && value.AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY
    && !value.AGNO_RUNTIME_HTTP_SECURITY_KEY
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AGNO_RUNTIME_HTTP_SECURITY_KEY'],
      message: 'Agno runtime HTTP authentication is required but not configured.',
    });
  }
  if (
    value.AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED
    && (
      !value.AGNO_RUNTIME_HTTP_ENABLED
      || !value.AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY
      || !value.AGNO_RUNTIME_HTTP_SECURITY_KEY
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED'],
      message: 'Agno tool gateway requires the authenticated Agno HTTP runtime channel.',
    });
  }
  if (value.NODE_ENV === 'production' && value.MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO'],
      message: 'MCP insecure local demo transport is forbidden in production.',
    });
  }
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
