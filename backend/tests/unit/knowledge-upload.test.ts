import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadUpload(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    DATABASE_URL: originalEnv.DATABASE_URL ?? 'postgresql://orchestra:orchestra@localhost:5432/orchestra',
    JWT_SECRET: 'test-secret',
    KNOWLEDGE_MAX_UPLOAD_BYTES: undefined,
    KNOWLEDGE_ALLOWED_FILE_TYPES: undefined,
    ...overrides,
  };
  return import('../../src/modules/knowledge/knowledge.upload');
}

describe('knowledge upload parser', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('parses TXT uploads deterministically without retaining binary data', async () => {
    const { parseKnowledgeUpload, formatKnowledgeUploadSize } = await loadUpload();
    const parsed = parseKnowledgeUpload({
      body: Buffer.from('\uFEFFTitulo\r\n\r\n  Corpo   do documento.  ', 'utf8'),
      fileName: encodeURIComponent('manual-operacional.txt'),
      contentType: 'text/plain; charset=utf-8',
    });

    expect(parsed).toMatchObject({
      fileName: 'manual-operacional.txt',
      extension: 'txt',
      mimeType: 'text/plain',
      contentText: 'Titulo\n\nCorpo do documento.',
    });
    expect(formatKnowledgeUploadSize(parsed.sizeBytes)).toBe('1 KB');
  });

  it('normalizes CSV rows with quoted values into text lines', async () => {
    const { parseKnowledgeUpload } = await loadUpload();
    const parsed = parseKnowledgeUpload({
      body: Buffer.from('nome,cargo\n"Ana, Silva","Head ""Ops"""\nBruno,Analista', 'utf8'),
      fileName: 'pessoas.csv',
      contentType: 'text/csv',
    });

    expect(parsed.contentText).toBe('nome | cargo\nAna, Silva | Head "Ops"\nBruno | Analista');
  });

  it('rejects unsupported extensions and mismatched MIME types with sanitized errors', async () => {
    const { parseKnowledgeUpload } = await loadUpload();

    expect(() => parseKnowledgeUpload({
      body: Buffer.from('conteudo', 'utf8'),
      fileName: 'contrato.pdf',
      contentType: 'application/pdf',
    })).toThrowError(expect.objectContaining({ code: 'KNOWLEDGE_UPLOAD_FILE_TYPE_NOT_SUPPORTED' }));

    expect(() => parseKnowledgeUpload({
      body: Buffer.from('# titulo', 'utf8'),
      fileName: 'manual.md',
      contentType: 'application/pdf',
    })).toThrowError(expect.objectContaining({ code: 'KNOWLEDGE_UPLOAD_MIME_MISMATCH' }));
  });

  it('rejects binary content, oversized files and disabled extensions', async () => {
    const { parseKnowledgeUpload } = await loadUpload({ KNOWLEDGE_MAX_UPLOAD_BYTES: '1024', KNOWLEDGE_ALLOWED_FILE_TYPES: 'txt,md' });

    expect(() => parseKnowledgeUpload({
      body: Buffer.from([65, 0, 66]),
      fileName: 'binario.txt',
      contentType: 'text/plain',
    })).toThrowError(expect.objectContaining({ code: 'KNOWLEDGE_UPLOAD_BINARY_NOT_SUPPORTED' }));

    expect(() => parseKnowledgeUpload({
      body: Buffer.from('x'.repeat(1025), 'utf8'),
      fileName: 'grande.txt',
      contentType: 'text/plain',
    })).toThrowError(expect.objectContaining({ code: 'KNOWLEDGE_UPLOAD_TOO_LARGE' }));

    expect(() => parseKnowledgeUpload({
      body: Buffer.from('nome,cargo\nAna,Ops', 'utf8'),
      fileName: 'pessoas.csv',
      contentType: 'text/csv',
    })).toThrowError(expect.objectContaining({ code: 'KNOWLEDGE_UPLOAD_FILE_TYPE_NOT_ALLOWED' }));
  });

  it('defaults upload max size to 1 MB and rejects invalid configured bounds', async () => {
    const { parseKnowledgeUpload } = await loadUpload();

    expect(() => parseKnowledgeUpload({
      body: Buffer.alloc(1_048_577, 'x'),
      fileName: 'default-too-large.txt',
      contentType: 'text/plain',
    })).toThrowError(expect.objectContaining({ code: 'KNOWLEDGE_UPLOAD_TOO_LARGE' }));

    await expect(loadUpload({ KNOWLEDGE_MAX_UPLOAD_BYTES: '1023' })).rejects.toThrow();
    await expect(loadUpload({ KNOWLEDGE_MAX_UPLOAD_BYTES: '10485761' })).rejects.toThrow();
  });
});
