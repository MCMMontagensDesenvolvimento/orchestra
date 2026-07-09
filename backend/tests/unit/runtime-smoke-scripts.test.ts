import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
const smokeScripts = [
  'scripts/smoke-agno-runtime-contract.sh',
  'scripts/smoke-agno-runtime-mvp.sh',
  'scripts/smoke-chat-contexto-15e.sh',
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
});
