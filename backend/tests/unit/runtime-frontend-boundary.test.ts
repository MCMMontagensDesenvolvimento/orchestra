import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendSrc = resolve(__dirname, '../../../frontend/src');
const forbiddenDirectRuntimePatterns = [
  /AGNO_RUNTIME_HTTP/i,
  /AGNO_RUNTIME_HTTP_BASE_URL/i,
  /AGNO_RUNTIME_HTTP_SECURITY_KEY/i,
  /127\.0\.0\.1:8091/,
  /localhost:8091/,
  /\/execute\b/,
];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    if (/\.(ts|tsx|js|jsx)$/.test(path)) return [path];
    return [];
  });
}

describe('runtime frontend boundary', () => {
  it('does not expose or call Agno HTTP runtime directly from frontend source', () => {
    const matches = sourceFiles(frontendSrc).flatMap((file) => {
      const content = readFileSync(file, 'utf8');
      return forbiddenDirectRuntimePatterns
        .filter((pattern) => pattern.test(content))
        .map((pattern) => ({ file, pattern: String(pattern) }));
    });

    expect(matches).toEqual([]);
  });
});
