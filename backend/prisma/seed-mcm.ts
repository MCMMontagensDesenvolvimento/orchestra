import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MCM_BOOTSTRAP = {
  tenant: {
    name: 'MCM',
    slug: 'mcm',
  },
  workspace: {
    name: 'Principal',
    slug: 'principal',
    description: 'Workspace principal corporativo da MCM.',
  },
  admin: {
    name: 'Leonardo Silva',
    email: 'leonardo.silva@mcm.eng.br',
  },
} as const;

const permissions = [
  'users.read',
  'users.manage',
  'roles.read',
  'roles.manage',
  'permissions.read',
  'permissions.manage',
  'tenants.read',
  'tenants.manage',
  'workspaces.read',
  'workspaces.manage',
  'assistants.read',
  'assistants.create',
  'assistants.update',
  'assistants.publish',
  'assistants.unpublish',
  'assistants.rollback',
  'assistants.share',
  'assistants.archive',
  'assistants.restore',
  'assistants.approval.request',
  'assistants.approval.approve',
  'assistants.approval.reject',
  'assistants.approval.cancel',
  'assistants.execution.configure',
  'assistants.execution.sandbox',
  'assistants.execution.enable',
  'assistants.publications.read',
  'assistants.publications.manage',
  'assistants.feedback.read',
  'assistants.feedback.create',
  'assistants.testResults.read',
  'assistants.testResults.create',
  'agent_runs.read',
  'agent_runs.create',
  'agent_runs.cancel',
  'agent_runs.audit',
  'llm.providers.read',
  'llm.providers.test',
  'llm.config.read',
  'execution.precheck',
  'execution.run_sandbox',
  'execution.run_published',
  'knowledge.read',
  'knowledge.manage',
  'knowledge.create',
  'knowledge.update',
  'knowledge.archive',
  'knowledge.restore',
  'knowledge.bind',
  'knowledge.ingestion.read',
  'knowledge.ingestion.manage',
  'mcp.read',
  'mcp.manage',
  'mcp.create',
  'mcp.update',
  'mcp.archive',
  'mcp.restore',
  'mcp.bind',
  'mcp.tools.read',
  'mcp.tools.manage',
  'mcp.policies.manage',
  'mcp.execution_approvals.read',
  'mcp.execution_approvals.request',
  'mcp.execution_approvals.approve',
  'mcp.execution_approvals.reject',
  'mcp.execution_approvals.cancel',
  'audit.read',
  'ai.quality.read',
  'ai.quality.write',
  'settings.read',
  'settings.manage',
] as const;

const roles = [
  'admin_platform',
  'creator_owner',
  'editor',
  'consumer',
  'auditor',
] as const;

const roleDescriptions: Record<(typeof roles)[number], string> = {
  admin_platform: 'Administrador da plataforma com acesso completo.',
  creator_owner: 'Criador e proprietário de assistentes e recursos sob sua governança.',
  editor: 'Editor de assistentes e recursos autorizados.',
  consumer: 'Consumidor dos recursos publicados e autorizados.',
  auditor: 'Auditor com acesso de leitura a evidências e registros de governança.',
};

const rolePermissionKeys: Record<(typeof roles)[number], readonly string[]> = {
  admin_platform: permissions,
  creator_owner: [
    'assistants.read',
    'assistants.create',
    'assistants.update',
    'assistants.publish',
    'assistants.unpublish',
    'assistants.rollback',
    'assistants.share',
    'assistants.archive',
    'assistants.restore',
    'assistants.approval.request',
    'assistants.approval.cancel',
    'assistants.execution.configure',
    'assistants.execution.sandbox',
    'assistants.execution.enable',
    'assistants.publications.read',
    'assistants.publications.manage',
    'assistants.feedback.read',
    'assistants.feedback.create',
    'assistants.testResults.read',
    'assistants.testResults.create',
    'agent_runs.read',
    'agent_runs.create',
    'agent_runs.cancel',
    'agent_runs.audit',
    'llm.providers.read',
    'llm.providers.test',
    'llm.config.read',
    'execution.precheck',
    'execution.run_sandbox',
    'execution.run_published',
    'knowledge.read',
    'knowledge.create',
    'knowledge.update',
    'knowledge.bind',
    'knowledge.ingestion.read',
    'knowledge.ingestion.manage',
    'mcp.read',
    'mcp.create',
    'mcp.update',
    'mcp.bind',
    'mcp.tools.read',
    'mcp.tools.manage',
    'mcp.execution_approvals.read',
    'mcp.execution_approvals.request',
    'mcp.execution_approvals.cancel',
    'audit.read',
    'ai.quality.read',
    'ai.quality.write',
    'settings.read',
  ],
  editor: [
    'assistants.read',
    'assistants.create',
    'assistants.update',
    'assistants.approval.request',
    'assistants.approval.cancel',
    'assistants.execution.sandbox',
    'assistants.publications.read',
    'assistants.feedback.create',
    'assistants.testResults.read',
    'assistants.testResults.create',
    'agent_runs.read',
    'agent_runs.create',
    'agent_runs.cancel',
    'llm.providers.read',
    'llm.providers.test',
    'llm.config.read',
    'execution.precheck',
    'execution.run_sandbox',
    'knowledge.read',
    'knowledge.bind',
    'knowledge.ingestion.read',
    'mcp.read',
    'mcp.bind',
    'mcp.tools.read',
    'mcp.execution_approvals.read',
    'mcp.execution_approvals.request',
    'mcp.execution_approvals.cancel',
    'ai.quality.read',
    'ai.quality.write',
    'settings.read',
  ],
  consumer: [
    'assistants.read',
    'assistants.feedback.create',
    'agent_runs.read',
    'agent_runs.create',
    'llm.providers.read',
    'execution.precheck',
    'execution.run_sandbox',
    'knowledge.read',
    'mcp.read',
    'mcp.tools.read',
    'mcp.execution_approvals.read',
  ],
  auditor: [
    'assistants.read',
    'assistants.publications.read',
    'assistants.feedback.read',
    'assistants.testResults.read',
    'agent_runs.read',
    'agent_runs.audit',
    'llm.providers.read',
    'llm.config.read',
    'knowledge.read',
    'knowledge.ingestion.read',
    'mcp.read',
    'mcp.tools.read',
    'mcp.execution_approvals.read',
    'audit.read',
    'ai.quality.read',
    'settings.read',
  ],
};

async function assertBootstrapAdminIsSafe(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const existing = await tx.user.findUnique({
    where: {
      email: MCM_BOOTSTRAP.admin.email,
    },
  });

  if (!existing) return;

  if (existing.tenantId !== tenantId) {
    throw new Error(
      `Bootstrap aborted: ${MCM_BOOTSTRAP.admin.email} already belongs to another tenant.`,
    );
  }

  if (existing.deletedAt !== null || existing.status !== 'active') {
    throw new Error(
      `Bootstrap aborted: ${MCM_BOOTSTRAP.admin.email} exists but is inactive or deleted.`,
    );
  }
}

async function bootstrapMcm(tx: Prisma.TransactionClient) {
  const tenant = await tx.tenant.upsert({
    where: {
      slug: MCM_BOOTSTRAP.tenant.slug,
    },
    update: {
      name: MCM_BOOTSTRAP.tenant.name,
      deletedAt: null,
    },
    create: {
      name: MCM_BOOTSTRAP.tenant.name,
      slug: MCM_BOOTSTRAP.tenant.slug,
      status: 'active',
    },
  });

  const workspace = await tx.workspace.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: MCM_BOOTSTRAP.workspace.slug,
      },
    },
    update: {
      name: MCM_BOOTSTRAP.workspace.name,
      description: MCM_BOOTSTRAP.workspace.description,
      status: 'active',
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      name: MCM_BOOTSTRAP.workspace.name,
      slug: MCM_BOOTSTRAP.workspace.slug,
      description: MCM_BOOTSTRAP.workspace.description,
      status: 'active',
    },
  });

  await assertBootstrapAdminIsSafe(tx, tenant.id);

  const admin = await tx.user.upsert({
    where: {
      email: MCM_BOOTSTRAP.admin.email,
    },
    update: {
      tenantId: tenant.id,
      name: MCM_BOOTSTRAP.admin.name,
      passwordHash: null,
      status: 'active',
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      email: MCM_BOOTSTRAP.admin.email,
      name: MCM_BOOTSTRAP.admin.name,
      passwordHash: null,
      status: 'active',
    },
  });

  const permissionRecords = await Promise.all(
    permissions.map((key) =>
      tx.permission.upsert({
        where: {
          key,
        },
        update: {},
        create: {
          key,
          description: `Allows ${key}`,
        },
      }),
    ),
  );

  const roleRecords = await Promise.all(
    roles.map((name) =>
      tx.role.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name,
          },
        },
        update: {
          description: roleDescriptions[name],
        },
        create: {
          tenantId: tenant.id,
          name,
          description: roleDescriptions[name],
        },
      }),
    ),
  );

  const permissionsByKey = new Map(
    permissionRecords.map((permission) => [permission.key, permission]),
  );

  const rolesByName = new Map(
    roleRecords.map((role) => [role.name, role]),
  );

  for (const [roleName, keys] of Object.entries(rolePermissionKeys)) {
    const role = rolesByName.get(roleName);

    if (!role) {
      throw new Error(`Bootstrap aborted: role ${roleName} was not created.`);
    }

    for (const key of keys) {
      const permission = permissionsByKey.get(key);

      if (!permission) {
        throw new Error(
          `Bootstrap aborted: permission ${key} was not created.`,
        );
      }

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const adminRole = rolesByName.get('admin_platform');

  if (!adminRole) {
    throw new Error('Bootstrap aborted: admin_platform role was not created.');
  }

  await tx.userRole.upsert({
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

  await tx.workspaceMembership.upsert({
    where: {
      userId_workspaceId: {
        userId: admin.id,
        workspaceId: workspace.id,
      },
    },
    update: {
      role: 'admin',
    },
    create: {
      userId: admin.id,
      workspaceId: workspace.id,
      role: 'admin',
    },
  });

  return {
    tenant,
    workspace,
    admin,
    permissionCount: permissionRecords.length,
    roleCount: roleRecords.length,
  };
}

async function main() {
  const result = await prisma.$transaction(
    async (tx) => bootstrapMcm(tx),
    {
      maxWait: 10_000,
      timeout: 60_000,
    },
  );

  console.log(
    [
      '[seed:mcm] Bootstrap complete.',
      `tenant=${result.tenant.slug}`,
      `workspace=${result.workspace.slug}`,
      `admin=${result.admin.email}`,
      `roles=${result.roleCount}`,
      `permissions=${result.permissionCount}`,
      'demo=disabled',
      'password=disabled',
      'externalIdentity=not-seeded',
    ].join(' '),
  );
}

void main()
  .catch((error) => {
    console.error('[seed:mcm] Bootstrap failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
