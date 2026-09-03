import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { seedMcpLocalDemo } from './mcp-local-demo.seed';
import { resolveSeedPolicy } from './seed-policy';
import {
  parseSeedTargetArguments,
  resolveSeedTarget,
  type ResolvedSeedTarget,
} from './seed-target';

const prisma = new PrismaClient();

const demoAssistantId = '00000000-0000-0000-0000-000000000101';
const demoAssistantVersion = '0.1.0';

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
];

const roles = [
  'admin_platform',
  'creator_owner',
  'editor',
  'consumer',
  'auditor',
];

const rolePermissionKeys: Record<string, string[]> = {
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

async function seedBootstrap({ tenant, workspace }: ResolvedSeedTarget) {
  const passwordHash = await bcrypt.hash('orchestra-dev-password', 12);
  const adminEmail = tenant.slug === 'orchestra-dev'
    ? 'admin.dev@orchestra.local'
    : `admin.dev+${tenant.slug}@orchestra.local`;
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      tenantId: tenant.id,
      name: 'Development Admin',
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      email: adminEmail,
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

  const permissionsByKey = new Map(permissionRecords.map((permission) => [permission.key, permission]));
  const rolesByName = new Map(roleRecords.map((role) => [role.name, role]));

  await Promise.all(
    Object.entries(rolePermissionKeys).flatMap(([roleName, keys]) => {
      const role = rolesByName.get(roleName);
      if (!role) return [];

      return keys.flatMap((key) => {
        const permission = permissionsByKey.get(key);
        if (!permission) return [];

        return prisma.rolePermission.upsert({
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
      });
    }),
  );

  return {
    tenant,
    workspace,
    admin,
  };
}

async function seedDemoData(input: Awaited<ReturnType<typeof seedBootstrap>>) {
  const assistant = await prisma.assistant.upsert({
    where: { id: demoAssistantId },
    update: {
      tenantId: input.tenant.id,
      workspaceId: input.workspace.id,
      name: 'Assistant Foundation Example',
      description: 'Dummy assistant used only for local backend foundation validation.',
      status: 'draft',
      createdById: input.admin.id,
      deletedAt: null,
    },
    create: {
      id: demoAssistantId,
      tenantId: input.tenant.id,
      workspaceId: input.workspace.id,
      name: 'Assistant Foundation Example',
      description: 'Dummy assistant used only for local backend foundation validation.',
      status: 'draft',
      createdById: input.admin.id,
    },
  });

  await prisma.assistantVersion.upsert({
    where: {
      assistantId_version: {
        assistantId: assistant.id,
        version: demoAssistantVersion,
      },
    },
    update: {
      status: 'draft',
      displayName: 'Foundation draft',
      description: 'Initial local draft for governance validation.',
      instructions: 'Dummy instructions for local development only.',
      modelProvider: 'none',
      modelName: 'not-configured',
      temperature: '0.20',
      configuration: {
        source: 'seed-demo',
        runtimeEnabled: false,
      },
      createdById: input.admin.id,
    },
    create: {
      assistantId: assistant.id,
      version: demoAssistantVersion,
      status: 'draft',
      displayName: 'Foundation draft',
      description: 'Initial local draft for governance validation.',
      instructions: 'Dummy instructions for local development only.',
      modelProvider: 'none',
      modelName: 'not-configured',
      temperature: '0.20',
      configuration: {
        source: 'seed-demo',
        runtimeEnabled: false,
      },
      createdById: input.admin.id,
    },
  });

  await seedMcpLocalDemo(prisma, {
    tenantId: input.tenant.id,
    workspaceId: input.workspace.id,
    adminUserId: input.admin.id,
    assistantId: assistant.id,
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const policy = resolveSeedPolicy(process.env, argv);
  const targetArguments = parseSeedTargetArguments(argv);
  const target = await resolveSeedTarget(prisma, targetArguments);
  const bootstrap = await seedBootstrap(target);

  if (policy.demoRequested) {
    await seedDemoData(bootstrap);
  }

  console.log(
    [
      '[seed] Bootstrap complete.',
      `environment=${policy.environment}`,
      `tenant=${bootstrap.tenant.slug}`,
      `workspace=${bootstrap.workspace.slug}`,
      `target=${target.source}`,
      `admin=${bootstrap.admin.email}`,
      `demo=${policy.demoRequested ? 'enabled' : 'disabled'}`,
    ].join(' '),
  );
}

void main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
