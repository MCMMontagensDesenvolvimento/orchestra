import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { AppError } from '../../src/shared/errors/app-error';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  materializeRemoteCatalogEntry: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../../src/modules/mcp/mcp.service', () => ({
  mcpService: {
    materializeRemoteCatalogEntry:
      mocks.materializeRemoteCatalogEntry,
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
const entryId =
  '00000000-0000-0000-0000-000000000801';
const serverId =
  '00000000-0000-0000-0000-000000000701';
const toolId =
  '00000000-0000-0000-0000-000000000901';

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

function materializationResult(
  status: 'materialized' | 'already_materialized' = 'materialized',
) {
  return {
    status,
    catalogEntryId: entryId,
    serverId,
    mcpTool: {
      id: toolId,
      externalName: 'corporate.status.read',
      displayName: 'Corporate Status Read',
      riskLevel: 'low',
      requiresApproval: true,
      isEnabled: false,
      policy: {
        allowRuntimeExecution: false,
        sandboxOnly: true,
        requiresApproval: true,
        blockedByDefault: true,
      },
    },
    safeguards: {
      readOnly: true,
      runtimeEnabled: false,
      remoteExecutionEnabled: false,
      toolExecutionPerformed: false,
    },
  };
}

describe('MCP remote catalog materialization API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.recordAuditEvent.mockResolvedValue(undefined);

    mocks.materializeRemoteCatalogEntry.mockResolvedValue(
      materializationResult(),
    );
  });

  it('requires authentication and mcp.manage permission', async () => {
    await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .send({})
      .expect(401);

    const readOnlyUser: AuthenticatedUser = {
      ...adminUser,
      permissions: ['mcp.read'],
    };

    await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .set('Cookie', sessionCookie(readOnlyUser))
      .send({})
      .expect(403);

    expect(
      mocks.materializeRemoteCatalogEntry,
    ).not.toHaveBeenCalled();
  });

  it('accepts an empty public contract and returns only a closed materialization receipt', async () => {
    const response = await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .set('Cookie', sessionCookie())
      .send({})
      .expect(200);

    expect(response.body.data).toEqual(
      materializationResult(),
    );

    expect(
      mocks.materializeRemoteCatalogEntry,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.materializeRemoteCatalogEntry,
    ).toHaveBeenCalledWith(
      entryId,
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

    expect(response.body.data.mcpTool.isEnabled).toBe(false);

    expect(
      response.body.data.mcpTool.policy.allowRuntimeExecution,
    ).toBe(false);

    expect(
      response.body.data.safeguards.remoteExecutionEnabled,
    ).toBe(false);

    expect(
      response.body.data.safeguards.toolExecutionPerformed,
    ).toBe(false);
  });

  it('also accepts a POST with no explicit request body', async () => {
    const response = await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.body.data.status).toBe('materialized');

    expect(
      mocks.materializeRemoteCatalogEntry,
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects every attempt to inject materialization authority from the client', async () => {
    const forbiddenBodies = [
      {
        isEnabled: true,
      },
      {
        allowRuntimeExecution: true,
      },
      {
        requiresApproval: false,
      },
      {
        sandboxOnly: false,
      },
      {
        blockedByDefault: false,
      },
      {
        remoteExecutionEnabled: true,
      },
      {
        runtimeEnabled: true,
      },
      {
        mcpToolId: toolId,
      },
      {
        name: 'forged.tool',
      },
    ];

    for (const body of forbiddenBodies) {
      await request(createApp())
        .post(
          `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
        )
        .set('Cookie', sessionCookie())
        .send(body)
        .expect(422);
    }

    expect(
      mocks.materializeRemoteCatalogEntry,
    ).not.toHaveBeenCalled();
  });

  it('rejects invalid catalog entry identifiers before reaching the service', async () => {
    await request(createApp())
      .post(
        '/api/v1/mcp/remote-catalog/entries/not-a-uuid/materialize',
      )
      .set('Cookie', sessionCookie())
      .send({})
      .expect(422);

    expect(
      mocks.materializeRemoteCatalogEntry,
    ).not.toHaveBeenCalled();
  });

  it('maps missing entries to 404', async () => {
    mocks.materializeRemoteCatalogEntry.mockRejectedValueOnce(
      new AppError(
        404,
        'MCP_REMOTE_CATALOG_ENTRY_NOT_FOUND',
        'Entrada do catalogo MCP remoto nao encontrada.',
      ),
    );

    const response = await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .set('Cookie', sessionCookie())
      .send({})
      .expect(404);

    expect(response.body.code).toBe(
      'MCP_REMOTE_CATALOG_ENTRY_NOT_FOUND',
    );
  });

  it('maps governed materialization blocks to 409', async () => {
    mocks.materializeRemoteCatalogEntry.mockRejectedValueOnce(
      new AppError(
        409,
        'MCP_REMOTE_CATALOG_MATERIALIZATION_BLOCKED',
        'Materializacao MCP remota bloqueada.',
      ),
    );

    const response = await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .set('Cookie', sessionCookie())
      .send({})
      .expect(409);

    expect(response.body.code).toBe(
      'MCP_REMOTE_CATALOG_MATERIALIZATION_BLOCKED',
    );
  });

  it('returns the same closed receipt for an idempotent replay', async () => {
    mocks.materializeRemoteCatalogEntry.mockResolvedValueOnce(
      materializationResult('already_materialized'),
    );

    const response = await request(createApp())
      .post(
        `/api/v1/mcp/remote-catalog/entries/${entryId}/materialize`,
      )
      .set('Cookie', sessionCookie())
      .send({})
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: 'already_materialized',
      catalogEntryId: entryId,
      mcpTool: {
        id: toolId,
        isEnabled: false,
        requiresApproval: true,
        policy: {
          allowRuntimeExecution: false,
          sandboxOnly: true,
          blockedByDefault: true,
        },
      },
      safeguards: {
        runtimeEnabled: false,
        remoteExecutionEnabled: false,
        toolExecutionPerformed: false,
      },
    });
  });
});
