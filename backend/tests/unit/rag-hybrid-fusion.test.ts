import { describe, expect, it } from 'vitest';
import {
  fuseHybridRagCandidates,
  HYBRID_RRF_CONFIG,
  type HybridRagCandidate,
} from '../../src/modules/knowledge/rag-hybrid-fusion';

type Doc = 'atlas' | 'iris' | 'alvorada';

function ranking(ordered: Doc[], scores: Record<Doc, number>, matchType = 'content'): HybridRagCandidate[] {
  return ordered.map((chunkId, index) => ({ chunkId, rank: index + 1, score: scores[chunkId], matchType }));
}

function merge(lexical: HybridRagCandidate[], semantic: HybridRagCandidate[], stubKeywordPriority = false) {
  return fuseHybridRagCandidates({
    lexicalResults: lexical,
    semanticResults: semantic,
    stubKeywordPriority,
    limit: 5,
  });
}

describe('BUG-RAG-001 — fusao hibrida lexical + semantica', () => {
  it('RAG-05A: Atlas continua no topo quando os dois rankings concordam', () => {
    const lexical = ranking(['atlas', 'alvorada', 'iris'], { atlas: 0.8, alvorada: 0.2, iris: 0.2 });
    const semantic = ranking(['atlas', 'alvorada', 'iris'], { atlas: 0.506513, alvorada: 0.368428, iris: 0.368308 }, 'semantic_vector');
    const result = merge(lexical, semantic);
    expect(result.map(item => item.selected.chunkId)).toEqual(['atlas', 'alvorada', 'iris']);
    expect(result[0].lexical?.score).toBe(0.8);
    expect(result[0].semantic?.score).toBe(0.506513);
  });

  it('RAG-05B: Iris continua no topo quando os dois rankings concordam', () => {
    const lexical = ranking(['iris', 'alvorada', 'atlas'], { atlas: 0.4286, alvorada: 0.6, iris: 0.7333 });
    const semantic = ranking(['iris', 'alvorada', 'atlas'], { atlas: 0.335601, alvorada: 0.38542, iris: 0.55836 }, 'semantic_vector');
    const result = merge(lexical, semantic);
    expect(result[0].selected.chunkId).toBe('iris');
    expect(result[0].semantic?.score).toBe(0.55836);
  });

  it('RAG-05C: Alvorada passa ao topo quando a semantica desfaz o conflito lexical', () => {
    const lexical = ranking(['iris', 'alvorada', 'atlas'], { atlas: 0.5, alvorada: 0.5, iris: 0.5556 }, 'mixed');
    const semantic = ranking(['alvorada', 'iris', 'atlas'], { atlas: 0.414448, alvorada: 0.495701, iris: 0.42439 }, 'semantic_vector');
    const result = merge(lexical, semantic);
    expect(result.map(item => item.selected.chunkId)).toEqual(['alvorada', 'iris', 'atlas']);
    expect(result[0].fusedScore).toBeGreaterThan(result[1].fusedScore);
    expect(result[0].lexical?.rank).toBe(2);
    expect(result[0].semantic?.rank).toBe(1);
  });

  it('mantem uma fonte por chunk, scores originais e limite', () => {
    const lexical = ranking(['iris', 'alvorada', 'atlas'], { atlas: 0.5, alvorada: 0.5, iris: 0.5556 });
    const semantic = ranking(['alvorada', 'iris', 'atlas'], { atlas: 0.41, alvorada: 0.49, iris: 0.42 });
    const result = fuseHybridRagCandidates({ lexicalResults: lexical, semanticResults: semantic, limit: 2, stubKeywordPriority: false });
    expect(result).toHaveLength(2);
    expect(new Set(result.map(x => x.selected.chunkId)).size).toBe(2);
    expect(result[0].lexical?.score).toBe(0.5);
    expect(result[0].semantic?.score).toBe(0.49);
    expect(result.every(x => x.fusedScore >= 0 && x.fusedScore <= 1)).toBe(true);
  });

  it('considera candidatos apenas lexicais e apenas semanticos sem perder fontes', () => {
    const lexical = [{ chunkId: 'atlas', rank: 1, score: 0.9, matchType: 'content' }];
    const semantic = [{ chunkId: 'iris', rank: 1, score: 0.5, matchType: 'semantic_vector' }];
    const result = merge(lexical, semantic);
    expect(result.map(item => item.selected.chunkId).sort()).toEqual(['atlas', 'iris']);
    expect(result.find(x => x.selected.chunkId === 'atlas')?.semantic).toBeNull();
    expect(result.find(x => x.selected.chunkId === 'iris')?.lexical).toBeNull();
  });

  it('preserva prioridade lexical do stub mesmo quando a semantica tem score maior', () => {
    const lexical = [{ chunkId: 'atlas', rank: 1, score: 0.2, matchType: 'content' }];
    const semantic = [{ chunkId: 'iris', rank: 1, score: 0.99, matchType: 'semantic_vector' }];
    const result = merge(lexical, semantic, true);
    expect(result.map(item => item.selected.chunkId)).toEqual(['atlas', 'iris']);
    expect(result.map(item => item.fusedScore)).toEqual([0.2, 0.99]);
  });

  it('nao confunde pontuacao lexical com similaridade semantica', () => {
    expect(HYBRID_RRF_CONFIG.semanticWeight).toBeGreaterThan(HYBRID_RRF_CONFIG.lexicalWeight);
    const lexical = ranking(['iris', 'alvorada', 'atlas'], { atlas: 0.99, alvorada: 0.01, iris: 0.99 });
    const semantic = ranking(['alvorada', 'iris', 'atlas'], { atlas: 0.01, alvorada: 0.99, iris: 0.01 });
    const result = merge(lexical, semantic);
    expect(result[0].selected.chunkId).toBe('alvorada');
  });
});
