import { describe, it, expect } from 'vitest';
import { calculateCombinedSimilarity, DEFAULT_SIMILARITY_WEIGHTS } from '@/lib/classification/stringMatching';
import type { SimilarityWeights } from '@/lib/types';

describe('calculateCombinedSimilarity with custom weights', () => {
  it('applies custom weights correctly', () => {
    const weights = { ...DEFAULT_SIMILARITY_WEIGHTS, jaroWinkler: 0, dice: 0, tokenSort: 0, levenshtein: 1 };
    const scores = calculateCombinedSimilarity('abc', 'abd', weights);
    expect(scores.combined).toBe(scores.levenshtein);
  });

  it('throws when weights do not sum to 1', () => {
    const badWeights: SimilarityWeights = { levenshtein: 0.5, jaroWinkler: 0.5, dice: 0.5, tokenSort: 0 };
    // Cast to unknown so TypeScript allows passing invalid weights
    expect(() => calculateCombinedSimilarity('abc', 'abc', badWeights)).toThrow();
  });
});
