import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app/app';
import { env } from '../../src/config/env';
import { signSession } from '../../src/shared/security/session';
import type { AuthenticatedUser } from '../../src/shared/types/auth';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/modules/audit/audit.service', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const tenantId = '00000000-0000-0000-0000-000000000010';
const workspaceId = '00000000-0000-0000-0000-000000000020';
const userId = '00000000-0000-0000-0000-000000000001';

const testUser: AuthenticatedUser = {
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
  permissions: ['llm.providers.read', 'llm.providers.test', 'llm.config.read'],
};

function sessionCookie(user: AuthenticatedUser = testUser) {
  const token = signSession({ sub: user.id, user });
  return `${env.COOKIE_NAME}=${token}`;
}

describe('llm provider endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('returns sanitized provider catalog with external providers disabled by default', async () => {
    const response = await request(createApp())
      .get('/api/v1/llm/providers')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.map((provider: { provider: string }) => provider.provider)).toEqual([
      'local_deterministic',
      'agno_local',
      'openai',
      'azure_openai',
      'anthropic',
    ]);
    expect(response.body.data.find((provider: { provider: string; current: boolean }) => provider.provider === 'local_deterministic').current).toBe(true);
    expect(response.body.data.find((provider: { provider: string; health: { status: string } }) => provider.provider === 'openai').health.status).toBe('disabled');
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('api_key');
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('authorization');
  });

  it('returns sanitized llm config without secrets or endpoints', async () => {
    const response = await request(createApp())
      .get('/api/v1/llm/config')
      .set('Cookie', [sessionCookie()])
      .expect(200);

    expect(response.body.data.defaultProvider).toBe('local_deterministic');
    expect(response.body.data.providersEnabled).toBe(false);
    expect(response.body.data.openaiEnabled).toBe(false);
    expect(response.body.data.openaiBaseUrlConfigured).toBe(true);
    expect(JSON.stringify(response.body.data)).not.toContain('OPENAI_API_KEY');
    expect(JSON.stringify(response.body.data)).not.toContain('https://api.openai.com');
    expect(JSON.stringify(response.body.data).toLowerCase()).not.toContain('token');
  });

  it('protects llm endpoints with auth and permissions', async () => {
    await request(createApp()).get('/api/v1/llm/providers').expect(401);

    const response = await request(createApp())
      .get('/api/v1/llm/providers')
      .set('Cookie', [sessionCookie({ ...testUser, permissions: [] })])
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('runs deterministic local test generation without raw prompt or secrets in response', async () => {
    const response = await request(createApp())
      .post('/api/v1/llm/test-generation')
      .set('Cookie', [sessionCookie()])
      .send({
        provider: 'local_deterministic',
        input: 'Texto de teste local controlado para provider deterministico.',
        metadata: {
          prompt: 'redact me',
          nested: { token: 'hidden' },
        },
      })
      .expect(200);

    expect(response.body.data.provider).toBe('local_deterministic');
    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.outputPreview).toContain('Resposta deterministica local');
    expect(response.body.data.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(response.body.data)).not.toContain('Texto de teste local controlado');
    expect(JSON.stringify(response.body.data).toLowerCase()).not.toContain('redact me');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'llm_test_generation_completed',
      metadata: expect.objectContaining({
        inputHash: expect.any(String),
        inputPreviewChars: expect.any(Number),
      }),
    }));
  });

  it('blocks external provider generation fail-closed when disabled', async () => {
    const response = await request(createApp())
      .post('/api/v1/llm/test-generation')
      .set('Cookie', [sessionCookie()])
      .send({
        provider: 'openai',
        input: 'External provider should not be called.',
      })
      .expect(409);

    expect(response.body.code).toBe('LLM_PROVIDER_EXECUTION_BLOCKED');
    expect(response.body.message).toContain('disabled');
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain('api_key');
  });

  it('returns structured validation for invalid provider and oversized input', async () => {
    await request(createApp())
      .get('/api/v1/llm/providers/not-a-provider/health')
      .set('Cookie', [sessionCookie()])
      .expect(422);

    await request(createApp())
      .post('/api/v1/llm/test-generation')
      .set('Cookie', [sessionCookie()])
      .send({
        provider: 'local_deterministic',
        input: 'x'.repeat(501),
      })
      .expect(422);
  });
});
