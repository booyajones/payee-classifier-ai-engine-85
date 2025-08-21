import { describe, it, expect } from 'vitest';
import {
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  diceCoefficient,
  tokenSortRatio,
  calculateCombinedSimilarity
} from '../src/lib/classification/stringMatching.ts';

describe('string matching algorithms', () => {
  it('calculates Levenshtein similarity', () => {
    const sim = levenshteinSimilarity('kitten', 'sitting');
    expect(sim).toBeCloseTo(57.14, 2);
  });

  it('calculates Jaro-Winkler similarity', () => {
    const sim = jaroWinklerSimilarity('martha', 'marhta');
    expect(sim).toBeCloseTo(96.11, 2);
  });

  it('calculates Dice coefficient', () => {
    const sim = diceCoefficient('night', 'nacht');
    expect(sim).toBeCloseTo(25, 5);
  });

  it('calculates token sort ratio', () => {
    const sim = tokenSortRatio('New York Pizza', 'Pizza New York');
    expect(sim).toBe(100);
  });

  it('combines scores as weighted average', () => {
    const scores = calculateCombinedSimilarity('night', 'nacht');
    const expected =
      scores.levenshtein * 0.25 +
      scores.jaroWinkler * 0.35 +
      scores.dice * 0.25 +
      scores.tokenSort * 0.15;
    expect(scores.combined).toBeCloseTo(expected, 5);
  });
});

describe('string matching edge cases', () => {
  it('handles empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(100);
    expect(jaroWinklerSimilarity('', '')).toBe(100);
    expect(diceCoefficient('', '')).toBe(100);
    expect(tokenSortRatio('', '')).toBe(100);
    const emptyScores = calculateCombinedSimilarity('', '');
    expect(emptyScores.combined).toBe(100);

    expect(levenshteinSimilarity('abc', '')).toBe(0);
    expect(jaroWinklerSimilarity('abc', '')).toBe(0);
    expect(diceCoefficient('abc', '')).toBe(0);
    expect(tokenSortRatio('abc', '')).toBe(0);
    const oneEmptyScores = calculateCombinedSimilarity('abc', '');
    expect(oneEmptyScores.combined).toBe(0);
  });

  it('handles very short names', () => {
    const scores = calculateCombinedSimilarity('A', 'B');
    expect(scores.levenshtein).toBe(0);
    expect(scores.jaroWinkler).toBe(0);
    expect(scores.dice).toBe(0);
    expect(scores.tokenSort).toBe(0);
    expect(scores.combined).toBe(0);
  });

  it('detects high similarity pairs', () => {
    const scores = calculateCombinedSimilarity('International Business Machine', 'International Business Machines');
    expect(scores.combined).toBeGreaterThan(95);
  });
});
