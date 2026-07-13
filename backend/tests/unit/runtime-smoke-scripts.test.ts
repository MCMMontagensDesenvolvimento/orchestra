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
  'scripts/smoke-agno-runtime-security-16d.sh',
  'scripts/smoke-agno-real-16e.sh',
  'scripts/smoke-agno-demo-local-16g.sh',
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

  it('keeps the 16D preflight syntax-valid, offline by default, and secret-safe', () => {
    const script = 'scripts/smoke-agno-runtime-security-16d.sh';
    const path = resolve(repoRoot, script);
    const fakeCredential = ['phase16d', 'placeholder', 'credential'].join('-');
    const syntaxCheck = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
    const dryRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNTIME_PROVIDER: 'agno_http',
        RUNTIME_ADAPTER_ENABLED: 'true',
        RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false',
        AGNO_RUNTIME_HTTP_ENABLED: 'true',
        AGNO_RUNTIME_HTTP_BASE_URL: 'https://runtime.example.test/orchestra/',
        AGNO_RUNTIME_HTTP_TIMEOUT_MS: '15000',
        AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: 'true',
        AGNO_RUNTIME_HTTP_SECURITY_KEY: fakeCredential,
      },
    });
    const unsafeUrl = 'https://phase-user:phase-password@runtime.example.test';
    const unsafeRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        RUNTIME_PROVIDER: 'agno_http',
        RUNTIME_ADAPTER_ENABLED: 'true',
        RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false',
        AGNO_RUNTIME_HTTP_ENABLED: 'true',
        AGNO_RUNTIME_HTTP_BASE_URL: unsafeUrl,
        AGNO_RUNTIME_HTTP_TIMEOUT_MS: '15000',
        AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: 'false',
        AGNO_RUNTIME_HTTP_SECURITY_KEY: '',
      },
    });

    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(`${dryRun.stdout}${dryRun.stderr}`).not.toContain(fakeCredential);
    expect(dryRun.stdout).toMatch(/no network request was attempted/);
    expect(unsafeRun.status).not.toBe(0);
    expect(`${unsafeRun.stdout}${unsafeRun.stderr}`).not.toContain(unsafeUrl);

    const content = readFileSync(path, 'utf8');
    expect(content).not.toMatch(/(?:source|\.\s+)\s*[^\n]*\.env/);
    expect(content).not.toMatch(/dotenv/i);
    expect(content).not.toMatch(/set\s+-[a-z]*x/);
    expect(content).not.toMatch(/\/execute\b/);
    expect(content).not.toMatch(/\/chat\/conversations/);
    expect(content).not.toMatch(/(?:echo|printf)[^\n]*\$\{?AGNO_RUNTIME_HTTP_SECURITY_KEY/);
  });

  it('keeps the 16E homologation preflight fail-closed, offline by default, and secret-safe', () => {
    const script = 'scripts/smoke-agno-real-16e.sh';
    const path = resolve(repoRoot, script);
    const fakeCredential = ['phase16e', 'placeholder', 'credential'].join('-');
    const fakeUrl = 'https://runtime.example.test/orchestra/';
    const safeEnv = {
      ...process.env,
      CURL_BIN: '/definitely/unavailable/curl-must-not-run',
      RUNTIME_PROVIDER: 'agno_http',
      RUNTIME_ADAPTER_ENABLED: 'true',
      RUNTIME_REQUIRE_PRECHECK: 'true',
      RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false',
      RUNTIME_ALLOW_EXTERNAL_TOOLS: 'false',
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: fakeUrl,
      AGNO_RUNTIME_HTTP_TIMEOUT_MS: '15000',
      AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: 'true',
      AGNO_RUNTIME_HTTP_SECURITY_KEY: fakeCredential,
      AGNO_RUNTIME_HTTP_TOOLS_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: '0',
      AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: 'false',
      AGNO_ALLOW_EXTERNAL_TOOLS: 'false',
      AGNO_ALLOW_REMOTE_MCP: 'false',
      MCP_REMOTE_EXECUTION_ENABLED: 'false',
    };
    const syntaxCheck = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
    const helpRun = spawnSync('bash', [path, '--help'], { encoding: 'utf8' });
    const defaultRun = spawnSync('bash', [path], {
      encoding: 'utf8',
      env: safeEnv,
    });
    const dryRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: safeEnv,
    });
    const unsafeUrl = 'https://phase-user:phase-password@runtime.example.test';
    const unsafeRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        AGNO_RUNTIME_HTTP_BASE_URL: unsafeUrl,
      },
    });
    const executableToolsRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        RUNTIME_ALLOW_EXTERNAL_TOOLS: 'true',
      },
    });
    const toolGatewayRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: 'true',
      },
    });

    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
    expect(helpRun.status, helpRun.stderr).toBe(0);
    expect(helpRun.stdout).toMatch(/--dry-run.*--check-runtime/s);
    expect(defaultRun.status, defaultRun.stderr).toBe(0);
    expect(dryRun.status, dryRun.stderr).toBe(0);
    expect(dryRun.stdout).toMatch(/no network request was attempted/);

    for (const result of [defaultRun, dryRun]) {
      const output = `${result.stdout}${result.stderr}`;
      expect(output).not.toContain(fakeCredential);
      expect(output).not.toContain(fakeUrl);
      expect(output).not.toMatch(/Authorization|Bearer/i);
    }

    expect(unsafeRun.status).not.toBe(0);
    expect(`${unsafeRun.stdout}${unsafeRun.stderr}`).not.toContain(unsafeUrl);
    expect(`${unsafeRun.stdout}${unsafeRun.stderr}`).not.toContain('phase-password');
    expect(executableToolsRun.status).not.toBe(0);
    expect(toolGatewayRun.status).not.toBe(0);

    const content = readFileSync(path, 'utf8');
    expect(content).not.toMatch(/(?:source|\.\s+)\s*[^\n]*\.env/);
    expect(content).not.toMatch(/dotenv/i);
    expect(content).not.toMatch(/set\s+-[a-z]*x/);
    expect(content).not.toMatch(/\/execute\b/);
    expect(content).not.toMatch(/\/chat\/conversations/);
    expect(content).toMatch(/--check-runtime/);
    expect(content).toMatch(/\/health/);
    expect(content).toMatch(/\/capabilities/);
    expect(content).toMatch(/max_tool_calls.*"0"/);
    expect(content).toMatch(/tool_gateway_enabled.*false/);
  }, 15_000);

  it('keeps the 16G local demo preflight offline by default, secret-safe, and sandbox-only', () => {
    const script = 'scripts/smoke-agno-demo-local-16g.sh';
    const path = resolve(repoRoot, script);
    const fakeCredential = 'a'.repeat(64);
    const fakeUrl = 'http://127.0.0.1:8091';
    const safeEnv = {
      ...process.env,
      CURL_BIN: '/definitely/unavailable/curl-must-not-run',
      RUNTIME_PROVIDER: 'agno_http',
      RUNTIME_ADAPTER_ENABLED: 'true',
      RUNTIME_REQUIRE_PRECHECK: 'true',
      RUNTIME_ALLOW_PROVIDER_FALLBACK: 'false',
      RUNTIME_ALLOW_EXTERNAL_TOOLS: 'false',
      AGNO_RUNTIME_HTTP_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_BASE_URL: fakeUrl,
      AGNO_RUNTIME_HTTP_TIMEOUT_MS: '30000',
      AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: 'true',
      AGNO_RUNTIME_HTTP_SECURITY_KEY: fakeCredential,
      AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_MAX_RAG_SOURCES: '5',
      AGNO_RUNTIME_HTTP_MAX_RAG_EXCERPT_CHARS: '1200',
      AGNO_RUNTIME_HTTP_TOOLS_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_MAX_TOOL_DESCRIPTORS: '8',
      AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: '1',
      AGNO_RUNTIME_HTTP_MAX_TOOL_SCHEMA_CHARS: '6000',
      AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: 'true',
      AGNO_RUNTIME_HTTP_TOOL_GATEWAY_MAX_PAYLOAD_BYTES: '32768',
      AGNO_ALLOW_EXTERNAL_TOOLS: 'false',
      AGNO_ALLOW_REMOTE_MCP: 'false',
      MCP_REMOTE_EXECUTION_ENABLED: 'false',
    };

    const syntaxCheck = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
    const helpRun = spawnSync('bash', [path, '--help'], { encoding: 'utf8' });
    const defaultRun = spawnSync('bash', [path], { encoding: 'utf8', env: safeEnv });
    const dryRun = spawnSync('bash', [path, '--dry-run'], { encoding: 'utf8', env: safeEnv });
    const configRun = spawnSync('bash', [path, '--check-orchestra-config'], { encoding: 'utf8', env: safeEnv });
    const checklistRun = spawnSync('bash', [path, '--print-checklist'], { encoding: 'utf8' });
    const disabledGatewayRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: 'false',
        AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: '0',
      },
    });
    const inconsistentGatewayRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: '0',
      },
    });
    const externalToolsRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        RUNTIME_ALLOW_EXTERNAL_TOOLS: 'true',
      },
    });
    const remoteMcpRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        AGNO_ALLOW_REMOTE_MCP: 'true',
      },
    });
    const remoteExecutionRun = spawnSync('bash', [path, '--dry-run'], {
      encoding: 'utf8',
      env: {
        ...safeEnv,
        MCP_REMOTE_EXECUTION_ENABLED: 'true',
      },
    });

    expect(existsSync(path), `${script} should exist`).toBe(true);
    expect(syntaxCheck.status, syntaxCheck.stderr).toBe(0);
    expect(helpRun.status, helpRun.stderr).toBe(0);
    expect(helpRun.stdout).toMatch(/--dry-run.*--check-runtime/s);
    expect(checklistRun.status, checklistRun.stderr).toBe(0);
    expect(checklistRun.stdout).toMatch(/Manual 16G demo checklist/);

    for (const result of [defaultRun, dryRun, configRun, disabledGatewayRun]) {
      expect(result.status, result.stderr).toBe(0);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toMatch(/no network request was attempted/);
      expect(output).not.toContain(fakeCredential);
      expect(output).not.toContain(fakeUrl);
      expect(output).not.toMatch(/Authorization|Bearer/i);
    }

    expect(inconsistentGatewayRun.status).not.toBe(0);
    expect(externalToolsRun.status).not.toBe(0);
    expect(remoteMcpRun.status).not.toBe(0);
    expect(remoteExecutionRun.status).not.toBe(0);

    const content = readFileSync(path, 'utf8');
    expect(content).not.toMatch(/(?:source|\.\s+)\s*[^\n]*\.env/);
    expect(content).not.toMatch(/dotenv/i);
    expect(content).not.toMatch(/set\s+-[a-z]*x/);
    expect(content).not.toMatch(/\/execute\b/);
    expect(content).not.toMatch(/\/chat\/conversations/);
    expect(content).not.toMatch(/\/tool-calls\b/);
    expect(content).not.toMatch(/(?:echo|printf)[^\n]*\$\{?AGNO_RUNTIME_HTTP_SECURITY_KEY/);
    expect(content).toMatch(/--check-runtime/);
    expect(content).toMatch(/\/health/);
    expect(content).toMatch(/\/capabilities/);
    expect(content).toMatch(/max_tool_calls.*"1"/);
    expect(content).toMatch(/max_tool_calls.*"0"/);
  }, 15_000);
});
