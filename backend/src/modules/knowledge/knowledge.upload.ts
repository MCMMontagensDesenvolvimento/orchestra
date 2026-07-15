import { AppError } from '../../shared/errors/app-error';
import { normalizeContentText } from './knowledge.chunking';
import {
  getKnowledgeUploadConfig,
  type KnowledgeUploadExtension,
} from './knowledge.config';

const mimeTypesByExtension: Record<KnowledgeUploadExtension, ReadonlySet<string>> = {
  txt: new Set(['text/plain']),
  md: new Set(['text/markdown', 'text/plain']),
  csv: new Set(['text/csv', 'application/csv', 'text/plain']),
};

export interface ParsedKnowledgeUpload {
  fileName: string;
  extension: KnowledgeUploadExtension;
  mimeType: string;
  sizeBytes: number;
  contentText: string;
}

function sanitizedFileName(value: string) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Invalid percent encoding is handled by the regular filename validation below.
  }
  const name = decoded.trim().replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f]/g, '');
  if (!name || name.length > 240 || name === '.' || name === '..') {
    throw new AppError(422, 'KNOWLEDGE_UPLOAD_INVALID_FILENAME', 'Nome de arquivo invalido para upload de conhecimento.');
  }
  return name;
}

function fileExtension(fileName: string) {
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined;
  if (!extension || !['txt', 'md', 'csv'].includes(extension)) {
    throw new AppError(415, 'KNOWLEDGE_UPLOAD_FILE_TYPE_NOT_SUPPORTED', 'Tipo de arquivo nao suportado para upload de conhecimento.');
  }
  return extension as KnowledgeUploadExtension;
}

function normalizedMimeType(value: string | undefined) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function decodeUtf8(buffer: Buffer) {
  if (buffer.includes(0)) {
    throw new AppError(415, 'KNOWLEDGE_UPLOAD_BINARY_NOT_SUPPORTED', 'Arquivos binarios nao sao suportados neste fluxo de upload.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw new AppError(422, 'KNOWLEDGE_UPLOAD_INVALID_UTF8', 'O arquivo deve conter texto UTF-8 valido.');
  }
}

function parseCsvRows(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (character === '\n') {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (quoted) {
    throw new AppError(422, 'KNOWLEDGE_UPLOAD_CSV_PARSE_FAILED', 'Falha ao interpretar o arquivo CSV.');
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length === 0) {
    throw new AppError(422, 'KNOWLEDGE_UPLOAD_EMPTY', 'O arquivo enviado nao possui conteudo textual valido.');
  }
  return rows.map((columns) => columns.join(' | ')).join('\n');
}

export function formatKnowledgeUploadSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.ceil(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseKnowledgeUpload(input: {
  body: Buffer;
  fileName: string;
  contentType?: string;
}): ParsedKnowledgeUpload {
  const config = getKnowledgeUploadConfig();
  if (!Buffer.isBuffer(input.body) || input.body.length === 0) {
    throw new AppError(422, 'KNOWLEDGE_UPLOAD_EMPTY', 'O arquivo enviado esta vazio.');
  }
  if (input.body.length > config.maxUploadBytes) {
    throw new AppError(413, 'KNOWLEDGE_UPLOAD_TOO_LARGE', 'O arquivo excede o limite configurado para upload de conhecimento.');
  }

  const fileName = sanitizedFileName(input.fileName);
  const extension = fileExtension(fileName);
  if (!config.allowedExtensions.includes(extension)) {
    throw new AppError(415, 'KNOWLEDGE_UPLOAD_FILE_TYPE_NOT_ALLOWED', 'O tipo de arquivo nao esta habilitado para upload de conhecimento.');
  }

  const mimeType = normalizedMimeType(input.contentType);
  if (!mimeType || !mimeTypesByExtension[extension].has(mimeType)) {
    throw new AppError(415, 'KNOWLEDGE_UPLOAD_MIME_MISMATCH', 'MIME type incompativel com a extensao do arquivo.');
  }

  const decoded = decodeUtf8(input.body);
  const contentText = normalizeContentText(extension === 'csv' ? parseCsvRows(decoded) : decoded);
  if (!contentText) {
    throw new AppError(422, 'KNOWLEDGE_UPLOAD_EMPTY', 'O arquivo enviado nao possui conteudo textual valido.');
  }

  return {
    fileName,
    extension,
    mimeType,
    sizeBytes: input.body.length,
    contentText,
  };
}
