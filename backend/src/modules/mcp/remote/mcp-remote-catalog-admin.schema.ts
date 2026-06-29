import { z } from 'zod';
import { paginationQuerySchema } from '../../../shared/validation/pagination';

const hashSchema = z.string().trim().regex(/^[a-fA-F0-9]{64}$/).transform((value) => value.toLowerCase());

export const mcpRemoteCatalogEntryLifecycleStatusValues = [
'draft',
'blocked',
'approved_for_catalog',
'active',
'deprecated',
'archived',
] as const;

export const mcpRemoteCatalogRiskLevelValues = ['low', 'medium', 'high', 'critical'] as const;

export const mcpRemoteCatalogApplyLedgerStatusValues = [
'started',
'applied',
'blocked',
'no_changes',
'partially_applied',
'failed',
] as const;

export const mcpRemoteCatalogEntriesQuerySchema = paginationQuerySchema.extend({
sortBy: z.enum([
'createdAt',
'updatedAt',
'externalName',
'displayName',
'lifecycleStatus',
'riskLevel',
'importedAt',
'approvedAt',
'deprecatedAt',
'revision',
]).default('updatedAt'),
sortDirection: z.enum(['asc', 'desc']).default('desc'),
workspaceId: z.string().uuid().optional(),
serverId: z.string().uuid().optional(),
externalName: z.string().trim().min(1).max(128).optional(),
lifecycleStatus: z.enum(mcpRemoteCatalogEntryLifecycleStatusValues).optional(),
riskLevel: z.enum(mcpRemoteCatalogRiskLevelValues).optional(),
requiresApproval: z.coerce.boolean().optional(),
snapshotHash: hashSchema.optional(),
specHash: hashSchema.optional(),
catalogHash: hashSchema.optional(),
lastPlanHash: hashSchema.optional(),
lastApplyHash: hashSchema.optional(),
});

export const mcpRemoteCatalogApplyLedgersQuerySchema = paginationQuerySchema.extend({
sortBy: z.enum([
'createdAt',
'completedAt',
'status',
'planId',
'applyId',
]).default('createdAt'),
sortDirection: z.enum(['asc', 'desc']).default('desc'),
workspaceId: z.string().uuid().optional(),
serverId: z.string().uuid().optional(),
status: z.enum(mcpRemoteCatalogApplyLedgerStatusValues).optional(),
planId: z.string().trim().min(1).max(160).optional(),
planHash: hashSchema.optional(),
snapshotHash: hashSchema.optional(),
applyId: z.string().trim().min(1).max(160).optional(),
applyHash: hashSchema.optional(),
idempotencyKey: hashSchema.optional(),
approvedByUserId: z.string().uuid().optional(),
createdAtFrom: z.coerce.date().optional(),
createdAtTo: z.coerce.date().optional(),
});

export type McpRemoteCatalogEntriesQuery = z.infer<typeof mcpRemoteCatalogEntriesQuerySchema>;
export type McpRemoteCatalogApplyLedgersQuery = z.infer<typeof mcpRemoteCatalogApplyLedgersQuerySchema>;
