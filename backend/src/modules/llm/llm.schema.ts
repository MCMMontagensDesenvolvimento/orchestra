import { z } from 'zod';
import { llmProviderNameValues } from './llm.types';

export const llmProviderParamSchema = z.object({
  provider: z.enum(llmProviderNameValues),
});

export const llmTestGenerationSchema = z.object({
  provider: z.enum(llmProviderNameValues).default('local_deterministic'),
  input: z.string().trim().min(1).max(500),
  model: z.string().trim().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type LlmTestGenerationInput = z.infer<typeof llmTestGenerationSchema>;
