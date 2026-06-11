import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/validation/pagination';

export const mcpServerStatusValues = ['active', 'disabled', 'archived'] as const;
export const mcpServerTypeValues = ['internal', 'external', 'local', 'remote'] as const;
export const mcpTrustLevelValues = ['trusted', 'restricted', 'experimental'] as const;
export const mcpRiskLevelValues = ['low', 'medium', 'high', 'critical'] as const;
export const mcpAuthTypeValues = ['none', 'api_key', 'bearer', 'oauth', 'mTLS', 'other'] as const;
export const assistantMcpModeValues = ['disabled', 'sandbox_only', 'enabled_placeholder'] as const;

const unsafeJsonKeys = new Set([
  'secret',
  'secrets',
  'token',
  'tokens',
  'password',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'privatekey',
  'private_key',
]);

function hasUnsafeJsonKey(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 6) return false;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeJsonKey(item, depth + 1));
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    const normalized = key.replace(/[-\s]/g, '').toLowerCase();
    return unsafeJsonKeys.has(normalized) || hasUnsafeJsonKey(item, depth + 1);
  });
}

function hasUnsafeTemplate(value: string | undefined | null) {
  if (!value) return false;
  return /(secret|token|password|api[_-]?key|authorization)/i.test(value);
}

const safeJsonRecord = z.record(z.unknown()).refine((value) => !hasUnsafeJsonKey(value), {
  message: 'Nao informe secrets, tokens, passwords, api keys ou authorization em JSON de catalogo.',
});

export const mcpServersQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['name', 'status', 'updatedAt', 'createdAt']).default('updatedAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(mcpServerStatusValues).optional(),
  workspaceId: z.string().uuid().optional(),
  trustLevel: z.enum(mcpTrustLevelValues).optional(),
  riskLevel: z.enum(mcpRiskLevelValues).optional(),
});

export const mcpServerCreateSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  serverType: z.enum(mcpServerTypeValues).default('remote'),
  baseUrl: z.string().trim().max(1000).url().optional(),
  status: z.enum(mcpServerStatusValues).default('disabled'),
  trustLevel: z.enum(mcpTrustLevelValues).default('restricted'),
  riskLevel: z.enum(mcpRiskLevelValues).default('medium'),
  authType: z.enum(mcpAuthTypeValues).default('none'),
  secretRef: z.string().trim().max(240).optional(),
  metadata: safeJsonRecord.optional(),
});

export const mcpServerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  serverType: z.enum(mcpServerTypeValues).optional(),
  baseUrl: z.string().trim().max(1000).url().nullable().optional(),
  status: z.enum(mcpServerStatusValues).optional(),
  trustLevel: z.enum(mcpTrustLevelValues).optional(),
  riskLevel: z.enum(mcpRiskLevelValues).optional(),
  authType: z.enum(mcpAuthTypeValues).optional(),
  secretRef: z.string().trim().max(240).nullable().optional(),
  metadata: safeJsonRecord.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const mcpServerChildParamsSchema = z.object({
  id: z.string().uuid(),
});

export const mcpToolCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  inputSchema: safeJsonRecord.optional(),
  outputSchema: safeJsonRecord.optional(),
  riskLevel: z.enum(mcpRiskLevelValues).default('medium'),
  requiresApproval: z.boolean().optional(),
  isEnabled: z.boolean().default(true),
  metadata: safeJsonRecord.optional(),
});

export const mcpToolUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  inputSchema: safeJsonRecord.nullable().optional(),
  outputSchema: safeJsonRecord.nullable().optional(),
  riskLevel: z.enum(mcpRiskLevelValues).optional(),
  requiresApproval: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  metadata: safeJsonRecord.nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const mcpToolParamsSchema = z.object({
  toolId: z.string().uuid(),
});

export const mcpResourceCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  uri: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(1000).optional(),
  mimeType: z.string().trim().max(160).optional(),
  metadata: safeJsonRecord.optional(),
});

export const mcpPromptCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  template: z.string().trim().max(5000).optional().refine((value) => !hasUnsafeTemplate(value), {
    message: 'Templates nao devem conter secrets, tokens, passwords, api keys ou authorization.',
  }),
  metadata: safeJsonRecord.optional(),
});

export const assistantMcpBindingCreateSchema = z.object({
  mcpServerId: z.string().uuid(),
  mcpToolId: z.string().uuid().nullable().optional(),
  isEnabled: z.boolean().default(true),
  mode: z.enum(assistantMcpModeValues).default('sandbox_only'),
  requiresApprovalOverride: z.boolean().nullable().optional(),
});

export const assistantMcpBindingUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  mode: z.enum(assistantMcpModeValues).optional(),
  requiresApprovalOverride: z.boolean().nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, {
  message: 'Informe ao menos uma propriedade para atualizar.',
});

export const assistantMcpBindingParamsSchema = z.object({
  id: z.string().uuid(),
  bindingId: z.string().uuid(),
});

export type McpServersQuery = z.infer<typeof mcpServersQuerySchema>;
export type McpServerCreateInput = z.infer<typeof mcpServerCreateSchema>;
export type McpServerUpdateInput = z.infer<typeof mcpServerUpdateSchema>;
export type McpToolCreateInput = z.infer<typeof mcpToolCreateSchema>;
export type McpToolUpdateInput = z.infer<typeof mcpToolUpdateSchema>;
export type McpResourceCreateInput = z.infer<typeof mcpResourceCreateSchema>;
export type McpPromptCreateInput = z.infer<typeof mcpPromptCreateSchema>;
export type AssistantMcpBindingCreateInput = z.infer<typeof assistantMcpBindingCreateSchema>;
export type AssistantMcpBindingUpdateInput = z.infer<typeof assistantMcpBindingUpdateSchema>;
