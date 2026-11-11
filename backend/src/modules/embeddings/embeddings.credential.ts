import { readFileSync } from 'node:fs';

/**
 * Um arquivo configurado e autoritativo: falhas de leitura ou arquivo vazio
 * nunca recaem na credencial por variavel de ambiente.
 * Nao inclua o valor nem a excecao de leitura em logs.
 */
export function resolveOpenAiEmbeddingCredential(input: {
  filePath?: string | null;
  fallbackValue?: string | null;
}): string | null {
  const filePath = input.filePath?.trim();
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf8').trim() || null;
    } catch {
      return null;
    }
  }
  return input.fallbackValue?.trim() || null;
}
