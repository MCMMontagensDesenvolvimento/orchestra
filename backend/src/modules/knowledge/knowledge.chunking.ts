import { createHash } from 'crypto';

export const localChunkingDefaults = {
  chunkSizeChars: 1200,
  chunkOverlapChars: 150,
  maxDocumentChars: 100000,
} as const;

export interface LocalChunkingConfig {
  chunkSizeChars?: number;
  chunkOverlapChars?: number;
  maxDocumentChars?: number;
}

export interface LocalChunk {
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenEstimate: number;
  charCount: number;
  startOffset: number;
  endOffset: number;
  sectionTitle: string | null;
}

interface RawChunk {
  content: string;
  startOffset: number;
  endOffset: number;
}

export function hashText(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeContentText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function sectionTitle(value: string) {
  const firstLine = value.split('\n').find((line) => line.trim().length > 0)?.trim();
  if (!firstLine) return null;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

function paragraphsWithOffsets(normalized: string) {
  const paragraphs: Array<{ content: string; startOffset: number; endOffset: number }> = [];
  const pattern = /[^\n](?:[\s\S]*?[^\n])?(?=\n{2,}|$)/g;
  for (const match of normalized.matchAll(pattern)) {
    const content = match[0].trim();
    if (!content) continue;
    const startOffset = match.index ?? 0;
    paragraphs.push({
      content,
      startOffset,
      endOffset: startOffset + match[0].length,
    });
  }
  return paragraphs;
}

function splitLongParagraph(paragraph: { content: string; startOffset: number }, chunkSizeChars: number, chunkOverlapChars: number) {
  const chunks: RawChunk[] = [];
  let start = 0;

  while (start < paragraph.content.length) {
    const end = Math.min(start + chunkSizeChars, paragraph.content.length);
    const content = paragraph.content.slice(start, end).trim();
    if (content) {
      chunks.push({
        content,
        startOffset: paragraph.startOffset + start,
        endOffset: paragraph.startOffset + end,
      });
    }
    if (end >= paragraph.content.length) break;
    start = Math.max(start + 1, end - chunkOverlapChars);
  }

  return chunks;
}

export function chunkContentText(rawText: string, config: LocalChunkingConfig = {}): LocalChunk[] {
  const settings = {
    ...localChunkingDefaults,
    ...config,
  };
  const normalized = normalizeContentText(rawText);
  if (!normalized) return [];
  if (normalized.length > settings.maxDocumentChars) {
    throw new Error(`DOCUMENT_TEXT_TOO_LARGE:${settings.maxDocumentChars}`);
  }

  const rawChunks: RawChunk[] = [];
  let current: RawChunk | null = null;

  const flushCurrent = () => {
    if (!current) return;
    rawChunks.push(current);
    current = null;
  };

  for (const paragraph of paragraphsWithOffsets(normalized)) {
    if (paragraph.content.length > settings.chunkSizeChars) {
      flushCurrent();
      rawChunks.push(...splitLongParagraph(paragraph, settings.chunkSizeChars, settings.chunkOverlapChars));
      continue;
    }

    if (!current) {
      current = {
        content: paragraph.content,
        startOffset: paragraph.startOffset,
        endOffset: paragraph.endOffset,
      };
      continue;
    }

    const nextContent: string = `${current.content}\n\n${paragraph.content}`;
    if (nextContent.length <= settings.chunkSizeChars) {
      current = {
        content: nextContent,
        startOffset: current.startOffset,
        endOffset: paragraph.endOffset,
      };
      continue;
    }

    flushCurrent();
    current = {
      content: paragraph.content,
      startOffset: paragraph.startOffset,
      endOffset: paragraph.endOffset,
    };
  }

  flushCurrent();

  return rawChunks.map((chunk, index) => {
    const overlapPrefix = index > 0 && settings.chunkOverlapChars > 0
      ? rawChunks[index - 1].content.slice(-settings.chunkOverlapChars).trim()
      : '';
    const content = overlapPrefix ? `${overlapPrefix}\n\n${chunk.content}` : chunk.content;
    return {
      chunkIndex: index,
      content,
      contentHash: hashText(content),
      tokenEstimate: estimateTokens(content),
      charCount: content.length,
      startOffset: overlapPrefix ? Math.max(0, chunk.startOffset - overlapPrefix.length) : chunk.startOffset,
      endOffset: chunk.endOffset,
      sectionTitle: sectionTitle(chunk.content),
    };
  });
}
