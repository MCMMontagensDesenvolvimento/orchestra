import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma/prisma.service';

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
  list(tenantId: string) {
    return prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },
};
