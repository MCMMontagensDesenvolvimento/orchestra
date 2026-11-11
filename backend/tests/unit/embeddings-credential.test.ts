import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOpenAiEmbeddingCredential } from '../../src/modules/embeddings/embeddings.credential';

const tempDirs: string[] = [];
function tempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestra-embedding-secret-'));
  tempDirs.push(dir);
  return join(dir, 'openai_embeddings_api_key');
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('credencial privada do provider de embeddings', () => {
  it('le um arquivo, removendo somente whitespace externo', () => {
    const path = tempPath();
    writeFileSync(path, ' chave-ficticia-para-teste\n');
    expect(resolveOpenAiEmbeddingCredential({ filePath: path, fallbackValue: 'fallback' }))
      .toBe('chave-ficticia-para-teste');
  });

  it('falha fechado se arquivo estiver ausente mesmo quando existir fallback', () => {
    const path = tempPath();
    expect(resolveOpenAiEmbeddingCredential({ filePath: path, fallbackValue: 'fallback' })).toBeNull();
  });

  it('falha fechado se arquivo estiver vazio', () => {
    const path = tempPath();
    writeFileSync(path, ' \n');
    expect(resolveOpenAiEmbeddingCredential({ filePath: path, fallbackValue: 'fallback' })).toBeNull();
  });

  it('so usa fallback se nao houver arquivo configurado', () => {
    expect(resolveOpenAiEmbeddingCredential({ fallbackValue: 'fallback' })).toBe('fallback');
    expect(resolveOpenAiEmbeddingCredential({})).toBeNull();
  });
});
