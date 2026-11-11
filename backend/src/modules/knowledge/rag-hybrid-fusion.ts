/**
 * Fusão governada de rankings para retrieval híbrido.
 * RRF usa somente posições, pois score lexical e similaridade vetorial
 * não pertencem à mesma escala. Valores de origem ficam disponíveis
 * ao chamador para auditoria separada.
 */
export const HYBRID_RRF_CONFIG = Object.freeze({
  k: 60,
  lexicalWeight: 1,
  semanticWeight: 1.5,
});

export interface HybridRagCandidate {
  chunkId: string;
  rank: number;
  score: number;
  matchType: string;
}

export interface HybridRagFusionHit<T extends HybridRagCandidate> {
  lexical: T | null;
  semantic: T | null;
  selected: T;
  fusedScore: number;
}

/** Retorna pontuação normalizada 0..1; não é probabilidade. */
function weightedRrfScore(lexicalRank: number | null, semanticRank: number | null): number {
  const { k, lexicalWeight, semanticWeight } = HYBRID_RRF_CONFIG;
  const lexicalContribution = lexicalRank === null ? 0 : lexicalWeight / (k + lexicalRank);
  const semanticContribution = semanticRank === null ? 0 : semanticWeight / (k + semanticRank);
  const maximum = (lexicalWeight + semanticWeight) / (k + 1);
  return Math.min(1, (lexicalContribution + semanticContribution) / maximum);
}

/**
 * Deduplica por chunkId, preserva o objeto lexical quando ambos encontram
 * o mesmo chunk (metadados e referência) e combina ranks em modo real.
 * Stub mantém a ordenação histórica lexical-first sem alterações.
 */
export function fuseHybridRagCandidates<T extends HybridRagCandidate>(input: {
  lexicalResults: T[];
  semanticResults: T[];
  limit: number;
  stubKeywordPriority: boolean;
}): HybridRagFusionHit<T>[] {
  const byChunkId = new Map<string, { lexical: T | null; semantic: T | null }>();

  for (const lexical of input.lexicalResults) {
    if (!byChunkId.has(lexical.chunkId)) {
      byChunkId.set(lexical.chunkId, { lexical, semantic: null });
    }
  }
  for (const semantic of input.semanticResults) {
    const existing = byChunkId.get(semantic.chunkId);
    if (existing) existing.semantic = semantic;
    else byChunkId.set(semantic.chunkId, { lexical: null, semantic });
  }

  return Array.from(byChunkId.values())
    .map(({ lexical, semantic }) => {
      const selected = lexical ?? semantic!;
      return {
        lexical,
        semantic,
        selected,
        fusedScore: input.stubKeywordPriority
          ? selected.score
          : weightedRrfScore(lexical?.rank ?? null, semantic?.rank ?? null),
      };
    })
    .sort((left, right) => {
      if (input.stubKeywordPriority && Boolean(left.lexical) !== Boolean(right.lexical)) {
        return left.lexical ? -1 : 1;
      }
      return right.fusedScore - left.fusedScore
        || left.selected.rank - right.selected.rank
        || left.selected.chunkId.localeCompare(right.selected.chunkId);
    })
    .slice(0, Math.max(0, input.limit));
}
