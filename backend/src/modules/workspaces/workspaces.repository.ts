import { prisma } from '../../infrastructure/prisma/prisma.service';
import { paginationOffset } from '../../shared/validation/pagination';
import type { WorkspaceCreateInput, WorkspacesQuery, WorkspaceUpdateInput } from './workspaces.schema';

export const workspacesRepository = {
  async list(tenantId: string, workspaceIds: string[] | undefined, query: WorkspacesQuery) {
    const where = {
      tenantId,
      ...(workspaceIds ? { id: { in: workspaceIds } } : {}),
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { slug: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDirection },
        ...paginationOffset(query),
      }),
      prisma.workspace.count({ where }),
    ]);
    return { data, total };
  },

  findById(id: string, tenantId: string, workspaceIds: string[] | undefined) {
    return prisma.workspace.findFirst({
      where: {
        tenantId,
        AND: [{ id }, ...(workspaceIds ? [{ id: { in: workspaceIds } }] : [])],
        deletedAt: null,
      },
    });
  },

  create(input: WorkspaceCreateInput & { tenantId: string; createdById: string; slug: string }) {
    return prisma.workspace.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        status: input.status,
        memberships: {
          create: {
            userId: input.createdById,
            role: 'admin',
          },
        },
      },
    });
  },

  async update(id: string, tenantId: string, workspaceIds: string[] | undefined, input: WorkspaceUpdateInput) {
    const existing = await prisma.workspace.findFirst({
      where: {
        tenantId,
        AND: [{ id }, ...(workspaceIds ? [{ id: { in: workspaceIds } }] : [])],
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return prisma.workspace.update({
      where: { id: existing.id },
      data: input,
    });
  },
};
