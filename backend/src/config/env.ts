import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
