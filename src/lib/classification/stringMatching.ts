
import { SimilarityScores, SimilarityWeights } from '../types';

/**
 * Advanced string matching library for payee name classification
 * Implements Levenshtein distance, Jaro-Winkler, Dice coefficient, and token-sort ratio
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate Levenshtein similarity as a percentage (0-100)
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Enhanced Jaro-Winkler similarity implementation
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 || len2 === 0) return 0;
  
  // Calculate match window
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchWindow < 0) return 0;
  
  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Identify matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }
  
  // Calculate Jaro similarity
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  
  // Calculate common prefix up to 4 characters
  let prefix = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }
  
  // Jaro-Winkler similarity
  return (jaro + 0.1 * prefix * (1 - jaro)) * 100;
}

/**
 * Calculate Dice coefficient between two strings
 */
export function diceCoefficient(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (str1.length < 2 || str2.length < 2) return 0;
  
  // Create bigrams
  const bigrams1 = new Set<string>();
  const bigrams2 = new Set<string>();
  
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }
  
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.substring(i, i + 2));
  }
  
  // Calculate intersection
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  
  return (2 * intersection.size) / (bigrams1.size + bigrams2.size) * 100;
}

/**
 * Tokenize string for token-sort ratio
 */
function tokenize(str: string): string[] {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0)
    .sort();
}

/**
 * Calculate token-sort ratio
 */
export function tokenSortRatio(str1: string, str2: string): number {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);
  
  const sorted1 = tokens1.join(' ');
  const sorted2 = tokens2.join(' ');
  
  return levenshteinSimilarity(sorted1, sorted2);
}

/**
 * Advanced name normalization for business entity detection
 */
export function advancedNormalization(name: string): {
  normalized: string;
  tokens: string[];
  businessIndicators: string[];
  individualIndicators: string[];
} {
  const businessTerms = [
    'LLC', 'INC', 'CORP', 'LTD', 'CO', 'COMPANY', 'CORPORATION', 'ENTERPRISES',
    'GROUP', 'HOLDINGS', 'PARTNERS', 'ASSOCIATES', 'SERVICES', 'SOLUTIONS',
    'AGENCY', 'STUDIO', 'CONSULTING', 'MANAGEMENT', 'SYSTEMS', 'TECHNOLOGIES'
  ];
  
  const individualTerms = [
    'DR', 'MR', 'MRS', 'MS', 'JR', 'SR', 'III', 'IV', 'ESQ', 'MD', 'PHD'
  ];
  
  // Normalize the name
  const normalized = name.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const tokens = normalized.split(' ');
  
  const businessIndicators = businessTerms.filter(term => 
    tokens.some(token => token === term || token.includes(term))
  );
  
  const individualIndicators = individualTerms.filter(term =>
    tokens.some(token => token === term || token.includes(term))
  );
  
  return {
    normalized,
    tokens,
    businessIndicators,
    individualIndicators
  };
}

/**
 * Combined similarity score using multiple algorithms
 */
export const DEFAULT_SIMILARITY_WEIGHTS: SimilarityWeights = {
  levenshtein: 0.25,
  jaroWinkler: 0.35,
  dice: 0.25,
  tokenSort: 0.15
};

export function calculateCombinedSimilarity(
  str1: string,
  str2: string,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS
): SimilarityScores {
  const finalWeights = { ...DEFAULT_SIMILARITY_WEIGHTS, ...weights };
  const totalWeight =
    finalWeights.levenshtein +
    finalWeights.jaroWinkler +
    finalWeights.dice +
    finalWeights.tokenSort;

  if (Math.abs(totalWeight - 1) > 0.0001) {
    throw new Error('Similarity weight totals must equal 1');
  }

  const levenshtein = levenshteinSimilarity(str1, str2);
  const jaroWinkler = jaroWinklerSimilarity(str1, str2);
  const dice = diceCoefficient(str1, str2);
  const tokenSort = tokenSortRatio(str1, str2);

  const combined =
    levenshtein * finalWeights.levenshtein +
    jaroWinkler * finalWeights.jaroWinkler +
    dice * finalWeights.dice +
    tokenSort * finalWeights.tokenSort;

  return {
    levenshtein,
    jaroWinkler,
    dice,
    tokenSort,
    combined
  };
}

/**
 * Find best matches from a list of candidates
 */
export function findBestMatches(
  target: string,
  candidates: string[],
  threshold: number = 70,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS
): Array<{ candidate: string; scores: SimilarityScores }> {
  const matches = candidates
    .map(candidate => ({
      candidate,
      scores: calculateCombinedSimilarity(target, candidate, weights)
    }))
    .filter(match => match.scores.combined >= threshold);

  return matches.sort((a, b) => b.scores.combined - a.scores.combined);
}
