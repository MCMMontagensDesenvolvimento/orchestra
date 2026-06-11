import { describe, expect, it } from 'vitest';
import { chunkContentText, hashText, normalizeContentText } from '../../src/modules/knowledge/knowledge.chunking';

describe('local knowledge chunking', () => {
  it('normalizes text and creates deterministic chunks', () => {
    const text = `Titulo do Documento\r\n\r\n  Primeiro   paragrafo com   espacos.\n\nSegundo paragrafo com conteudo suficiente para teste.`;
    const normalized = normalizeContentText(text);
    const chunks = chunkContentText(text, { chunkSizeChars: 60, chunkOverlapChars: 10 });

    expect(normalized).toContain('Primeiro paragrafo com espacos.');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      contentHash: hashText(chunks[0].content),
    });
    expect(chunks[0].charCount).toBe(chunks[0].content.length);
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
  });

  it('returns no chunks for empty content', () => {
    expect(chunkContentText('   \n\n   ')).toEqual([]);
  });
});
