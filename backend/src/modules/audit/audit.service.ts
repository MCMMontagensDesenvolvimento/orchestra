import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationMeta, paginationOffset } from '../../shared/validation/pagination';
import type { AuditQuery } from './audit.schema';

export interface AuditEventInput {
  tenantId?: string;
  workspaceId?: string;
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export async function recordAuditEvent(input: AuditEventInput) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    },
  });
}

export const auditService = {
  async list(tenantId: string, query: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' } },
              { entity: { contains: query.search, mode: 'insensitive' } },
              { entityId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [records, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.auditLog.count({ where }),
    ]);
    return {
      data: records.map((record) => ({
        id: record.id,
        tenantId: record.tenantId,
        workspaceId: record.workspaceId,
        actorUserId: record.actorUserId,
        action: record.action,
        entity: record.entity,
        entityId: record.entityId,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        requestId: record.requestId,
        createdAt: record.createdAt.toISOString(),
      })),
      pagination: paginationMeta(query, total),
    };
  },
};
