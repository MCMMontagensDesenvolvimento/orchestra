import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  'users.read',
  'users.manage',
  'roles.read',
  'permissions.read',
  'tenants.read',
  'tenants.manage',
  'workspaces.read',
  'workspaces.manage',
  'assistants.read',
  'assistants.create',
  'assistants.update',
  'assistants.publish',
  'assistants.share',
  'assistants.archive',
  'knowledge.read',
  'knowledge.manage',
  'mcp.read',
  'mcp.manage',
  'audit.read',
  'settings.manage',
];

const roles = [
  'admin_platform',
  'creator_owner',
  'editor',
  'consumer',
  'auditor',
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'orchestra-dev' },
    update: {},
    create: {
      name: 'Orchestra Dev Tenant',
      slug: 'orchestra-dev',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: 'default',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Default Workspace',
      slug: 'default',
    },
  });

  const passwordHash = await bcrypt.hash('orchestra-dev-password', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin.dev@orchestra.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin.dev@orchestra.local',
      name: 'Development Admin',
      passwordHash,
    },
  });

  const permissionRecords = await Promise.all(
    permissions.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: `Allows ${key}` },
      }),
    ),
  );

  const roleRecords = await Promise.all(
    roles.map((name) =>
      prisma.role.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          name,
          description: `Development role ${name}`,
        },
      }),
    ),
  );

  const adminRole = roleRecords.find((role) => role.name === 'admin_platform');
  if (!adminRole) {
    throw new Error('admin_platform role not created');
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId_workspaceId: {
        userId: admin.id,
        roleId: adminRole.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
      workspaceId: workspace.id,
    },
  });

  await prisma.workspaceMembership.upsert({
    where: {
      userId_workspaceId: {
        userId: admin.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      workspaceId: workspace.id,
      role: 'admin',
    },
  });

  await Promise.all(
    permissionRecords.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  await prisma.assistant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      tenantId: tenant.id,
      workspaceId: workspace.id,
      name: 'Assistant Foundation Example',
      description: 'Dummy assistant used only for local backend foundation validation.',
      status: 'draft',
      createdById: admin.id,
      versions: {
        create: {
          version: '0.1.0',
          status: 'draft',
          displayName: 'Foundation draft',
          instructions: 'Dummy instructions for local development only.',
          modelProvider: 'none',
          modelName: 'not-configured',
          temperature: '0.20',
          createdById: admin.id,
        },
      },
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
