import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { AppError } from '../../src/shared/errors/app-error';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  applyRemoteImportPlan: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/mcp/mcp.service', () => ({
  mcpService: {
    applyRemoteImportPlan: mocks.applyRemoteImportPlan,
  },
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId =
  '00000000-0000-0000-0000-000000000010';
const workspaceId =
  '00000000-0000-0000-0000-000000000020';
const userId =
  '00000000-0000-0000-0000-000000000001';
const serverId =
  '00000000-0000-0000-0000-000000000701';

const planHash = 'a'.repeat(64);
const planId =
  `mcp_remote_catalog_import_plan_${planHash.slice(0, 24)}`;

const adminUser: AuthenticatedUser = {
  id: userId,
  email: 'admin.dev@orchestra.local',
  name: 'Development Admin',
  tenant: {
    id: tenantId,
    name: 'Orchestra Dev Tenant',
    slug: 'orchestra-dev',
  },
  workspaces: [
    {
      id: workspaceId,
      name: 'Default Workspace',
      slug: 'default',
      role: 'admin',
    },
  ],
  roles: ['admin_platform'],
  permissions: ['mcp.manage'],
};

function sessionCookie(user: AuthenticatedUser = adminUser) {
  const token = signSession({
    sub: user.id,
    user,
  });

  return `${env.COOKIE_NAME}=${token}`;
}

function validBody() {
  return {
    planId,
    planHash,
    confirmManualApply: true,
    approvalReason:
      'Aprovado para inclusão no catálogo corporativo read-only.',
  };
}

describe('MCP remote manual apply API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.recordAuditEvent.mockResolvedValue(undefined);

    mocks.applyRemoteImportPlan.mockResolvedValue({
      applyId: 'mcp_remote_catalog_apply_api_test',
      applyHash: 'b'.repeat(64),
      planId,
      planHash,
      status: 'applied',
      operationResults: [
        {
          operationId: 'operation_test',
          externalName: 'corporate.status.read',
          type: 'create_tool_draft',
          status: 'applied',
          runtimeEnabled: false,
          remoteExecutionEnabled: false,
        },
      ],
      sanitizedMetadata: {
        noRuntimeEnablement: true,
        noRemoteToolExecution: true,
      },
    });
  });

  it('requires authentication and mcp.manage permission', async () => {
    await request(createApp())
      .post(
        `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
      )
      .send(validBody())
      .expect(401);

    const readOnlyUser: AuthenticatedUser = {
      ...adminUser,
      permissions: ['mcp.read'],
    };

    await request(createApp())
      .post(
        `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
      )
      .set('Cookie', sessionCookie(readOnlyUser))
      .send(validBody())
      .expect(403);

    expect(
      mocks.applyRemoteImportPlan,
    ).not.toHaveBeenCalled();
  });

  it('rejects false confirmation and client authority injection', async () => {
    await request(createApp())
      .post(
        `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
      )
      .set('Cookie', sessionCookie())
      .send({
        ...validBody(),
        confirmManualApply: false,
      })
      .expect(422);

    const forbiddenFields = [
      {
        approvedByUserId:
          '00000000-0000-0000-0000-000000000099',
      },
      {
        allowPendingApprovalApply: true,
      },
      {
        operations: [],
      },
      {
        dryRun: true,
      },
    ];

    for (const extra of forbiddenFields) {
      await request(createApp())
        .post(
          `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
        )
        .set('Cookie', sessionCookie())
        .send({
          ...validBody(),
          ...extra,
        })
        .expect(422);
    }

    expect(
      mocks.applyRemoteImportPlan,
    ).not.toHaveBeenCalled();
  });

  it('forwards only the validated public contract', async () => {
    const response = await request(createApp())
      .post(
        `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
      )
      .set('Cookie', sessionCookie())
      .send(validBody())
      .expect(200);

    expect(response.body.data).toMatchObject({
      planId,
      planHash,
      status: 'applied',
    });

    expect(
      mocks.applyRemoteImportPlan,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.applyRemoteImportPlan,
    ).toHaveBeenCalledWith(
      serverId,
      validBody(),
      expect.objectContaining({
        id: userId,
        tenant: expect.objectContaining({
          id: tenantId,
        }),
      }),
      expect.objectContaining({
        requestId: expect.any(String),
      }),
    );
  });

  it('maps missing persisted plans to 404', async () => {
    mocks.applyRemoteImportPlan.mockRejectedValueOnce(
      new AppError(
        404,
        'MCP_REMOTE_IMPORT_PLAN_NOT_FOUND',
        'Plano MCP remoto persistido nao encontrado.',
      ),
    );

    const response = await request(createApp())
      .post(
        `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
      )
      .set('Cookie', sessionCookie())
      .send(validBody())
      .expect(404);

    expect(response.body.code).toBe(
      'MCP_REMOTE_IMPORT_PLAN_NOT_FOUND',
    );
  });

  it('maps governed apply conflicts to 409', async () => {
    mocks.applyRemoteImportPlan.mockRejectedValueOnce(
      new AppError(
        409,
        'MCP_REMOTE_CATALOG_IMPORT_APPLY_BLOCKED',
        'Manual Apply bloqueado.',
      ),
    );

    const response = await request(createApp())
      .post(
        `/api/v1/mcp/servers/${serverId}/remote-import-apply`,
      )
      .set('Cookie', sessionCookie())
      .send(validBody())
      .expect(409);

    expect(response.body.code).toBe(
      'MCP_REMOTE_CATALOG_IMPORT_APPLY_BLOCKED',
    );
  });
});
