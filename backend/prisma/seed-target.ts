import type { PrismaClient, Tenant, Workspace } from '@prisma/client';

const preferredLocalTarget = {
  tenantSlug: 'mcm',
  workspaceSlug: 'principal',
} as const;

const fallbackLocalTarget = {
  tenantSlug: 'orchestra-dev',
  workspaceSlug: 'default',
} as const;

export type SeedTargetArguments =
  | { explicit: false }
  | {
      explicit: true;
      tenantSlug: string;
      workspaceSlug: string;
    };

export interface ResolvedSeedTarget {
  tenant: Tenant;
  workspace: Workspace;
  source: 'explicit' | 'preferred-local' | 'fallback-local';
}

function parseArgumentValue(argv: string[], flag: '--tenant-slug' | '--workspace-slug') {
  let parsed: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    let value: string | undefined;

    if (argument === flag) {
      const nextArgument = argv[index + 1];
      if (!nextArgument || nextArgument.startsWith('--')) {
        throw new Error(`Seed argument ${flag} requires a non-empty value.`);
      }
      value = nextArgument;
      index += 1;
    } else if (argument.startsWith(`${flag}=`)) {
      value = argument.slice(flag.length + 1);
    }

    if (value === undefined) continue;
    if (parsed !== undefined) {
      throw new Error(`Seed argument ${flag} must be provided only once.`);
    }

    parsed = value.trim();
    if (!parsed) {
      throw new Error(`Seed argument ${flag} requires a non-empty value.`);
    }
  }

  return parsed;
}

export function parseSeedTargetArguments(argv = process.argv.slice(2)): SeedTargetArguments {
  const tenantSlug = parseArgumentValue(argv, '--tenant-slug');
  const workspaceSlug = parseArgumentValue(argv, '--workspace-slug');

  if ((tenantSlug && !workspaceSlug) || (!tenantSlug && workspaceSlug)) {
    throw new Error('Seed arguments --tenant-slug and --workspace-slug must be provided together.');
  }

  if (!tenantSlug || !workspaceSlug) {
    return { explicit: false };
  }

  return {
    explicit: true,
    tenantSlug,
    workspaceSlug,
  };
}

async function findExistingTarget(
  prisma: PrismaClient,
  tenantSlug: string,
  workspaceSlug: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return null;

  const workspace = await prisma.workspace.findUnique({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: workspaceSlug,
      },
    },
  });
  if (!workspace) return null;

  return { tenant, workspace };
}

export async function resolveSeedTarget(
  prisma: PrismaClient,
  arguments_: SeedTargetArguments,
): Promise<ResolvedSeedTarget> {
  if (arguments_.explicit) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: arguments_.tenantSlug },
    });
    if (!tenant) {
      throw new Error(
        `Explicit seed tenant "${arguments_.tenantSlug}" was not found. No fallback tenant or workspace was created.`,
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: arguments_.workspaceSlug,
        },
      },
    });
    if (!workspace) {
      throw new Error(
        `Explicit seed workspace "${arguments_.workspaceSlug}" was not found in tenant "${arguments_.tenantSlug}". No fallback workspace was created.`,
      );
    }

    return { tenant, workspace, source: 'explicit' };
  }

  const preferred = await findExistingTarget(
    prisma,
    preferredLocalTarget.tenantSlug,
    preferredLocalTarget.workspaceSlug,
  );
  if (preferred) {
    return { ...preferred, source: 'preferred-local' };
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: fallbackLocalTarget.tenantSlug },
    update: {},
    create: {
      name: 'Orchestra Dev Tenant',
      slug: fallbackLocalTarget.tenantSlug,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: fallbackLocalTarget.workspaceSlug,
      },
    },
    update: {
      description: 'Workspace padrao para desenvolvimento local.',
    },
    create: {
      tenantId: tenant.id,
      name: 'Default Workspace',
      slug: fallbackLocalTarget.workspaceSlug,
      description: 'Workspace padrao para desenvolvimento local.',
    },
  });

  return { tenant, workspace, source: 'fallback-local' };
}
