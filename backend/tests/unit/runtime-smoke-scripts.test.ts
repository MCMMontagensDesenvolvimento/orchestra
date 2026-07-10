import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const smokeScripts = [
  'scripts/smoke-agno-runtime-contract.sh',
  'scripts/smoke-agno-runtime-mvp.sh',
  'scripts/smoke-chat-contexto-15e.sh',
  'scripts/smoke-chat-provider-real-15h.sh',
];

const destructivePatterns = [
  /docker\s+compose\s+down\s+-v/i,
  /prisma\s+migrate\s+reset/i,
  /prisma\s+db\s+push\s+--force-reset/i,
  new RegExp('drop\\s+' + 'database', 'i'),
  new RegExp('trun' + 'cate', 'i'),
  new RegExp('delete\\s+' + 'from', 'i'),
  /rm\s+-rf\s+\/(?:\s|$)/i,
];

describe('runtime smoke scripts', () => {
  it('keeps smoke scripts present and non-destructive', () => {
    for (const script of smokeScripts) {
      const path = resolve(repoRoot, script);
      expect(existsSync(path), `${script} should exist`).toBe(true);

      const content = readFileSync(path, 'utf8');
      expect(content).not.toMatch(/OPENAI_API_KEY=.*[A-Za-z0-9]{12,}/);
      expect(content).not.toMatch(/AZURE_OPENAI_API_KEY=.*[A-Za-z0-9]{12,}/);
      expect(content).not.toMatch(/MCP_.*TOKEN=.*[A-Za-z0-9]{12,}/);
      for (const pattern of destructivePatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('validates the frontend boundary without exposing Agno runtime settings', () => {
    const content = readFileSync(resolve(repoRoot, 'scripts/smoke-agno-runtime-mvp.sh'), 'utf8');

    expect(content).toMatch(/frontend\/src/);
    expect(content).toMatch(/AGNO_RUNTIME_HTTP/);
    expect(content).toMatch(/127\\\.0\\\.0\\\.1:8091/);
    expect(content).toMatch(/\/execute\\b/);
  });

  it('keeps the 15E smoke limited to read-only prerequisites', () => {
    const content = readFileSync(resolve(repoRoot, 'scripts/smoke-chat-contexto-15e.sh'), 'utf8');

    expect(content).toMatch(/migrate status/);
    expect(content).toMatch(/\/health/);
    expect(content).toMatch(/\/capabilities/);
    expect(content).not.toMatch(/\/execute\b/);
    expect(content).not.toMatch(/\/chat\/conversations/);
    expect(content).not.toMatch(/\/assistants\/.*\/runs/);
  });

  it('keeps the 15H smoke syntax-valid, secret-safe, and opt-in', () => {
    const script = 'scripts/smoke-chat-provider-real-15h.sh';
    const path = resolve(repoRoot, script);

    expect(existsSync(path), `${script} should exist`).toBe(true);

    const content = readFileSync(path, 'utf8');
    const syntaxCheck = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
    const fakeCredential = ['phase15h', 'placeholder', 'credential'].join('-');
    const dryRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        BASE_URL: 'http://localhost:3000',
        RUNTIME_PROVIDER: 'local',
        RUNTIME_ADAPTER_ENABLED: 'true',
        CHAT_CONTEXT_ENABLED: 'true',
        LLM_PROVIDERS_ENABLED: 'true',
        LLM_EXECUTION_ENABLED: 'true',
        OPENAI_ENABLED: 'true',
        OPENAI_EXECUTION_ENABLED: 'true',
        OPENAI_API_KEY: fakeCredential,
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
        OPENAI_DEFAULT_MODEL: 'phase15h-test-model',
      },
    });

    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(`${dryRun.stdout}${dryRun.stderr}`).not.toContain(fakeCredential);
    expect(dryRun.stdout).toMatch(/no external request was attempted/);
    expect(content).not.toMatch(/OPENAI_API_KEY=.*[A-Za-z0-9]{12,}/);
    expect(content).not.toMatch(/(?:echo|printf)[^\n]*\$\{?OPENAI_API_KEY/);
    expect(content).not.toMatch(/(?:echo|printenv)[^\n]*OPENAI_API_KEY/);
    expect(content).not.toMatch(/set\s+-[a-z]*x/);
    expect(content).toMatch(/\[ -n "\$\{OPENAI_API_KEY:-\}" \]/);
    expect(content).toMatch(/real_provider_ready/);
    expect(content).toMatch(/no external request was attempted/);
    expect(content).not.toMatch(/\/responses\b/);
    expect(content).not.toMatch(/\/test-generation\b/);
    expect(content).not.toMatch(/\/chat\/conversations/);
  });
});
