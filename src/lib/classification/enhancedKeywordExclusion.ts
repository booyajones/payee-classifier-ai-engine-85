
import { KeywordExclusionResult, SimilarityScores } from '../types';
import { calculateCombinedSimilarity, advancedNormalization } from './stringMatching';
import { getComprehensiveExclusionKeywords } from './keywordExclusion';
import { logger } from '../logger';

/**
 * Key used to store exclusion keywords in localStorage
 */
export const EXCLUDED_KEYWORDS_STORAGE_KEY = 'excludedKeywords';

// Load exclusion keywords from localStorage, initialize with comprehensive list if empty
function getExclusionKeywords(): string[] {
  try {
    const stored = localStorage.getItem(EXCLUDED_KEYWORDS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    
    // If no keywords in storage or empty array, initialize with comprehensive list
    const comprehensiveKeywords = getComprehensiveExclusionKeywords();
    localStorage.setItem(EXCLUDED_KEYWORDS_STORAGE_KEY, JSON.stringify(comprehensiveKeywords));
    logger.debug(`[ENHANCED EXCLUSION] Initialized localStorage with ${comprehensiveKeywords.length} comprehensive keywords`);
    return comprehensiveKeywords;
  } catch (error) {
    logger.warn('Failed to load exclusion keywords:', error);
    // Fallback to comprehensive list
    return getComprehensiveExclusionKeywords();
  }
}

/**
 * Enhanced keyword exclusion with similarity matching and detailed results
 */
export function checkKeywordExclusion(payeeName: string): KeywordExclusionResult {
  const exclusionKeywords = getExclusionKeywords();
  
  logger.debug(`[ENHANCED EXCLUSION] Checking "${payeeName}" against ${exclusionKeywords.length} keywords`);
  
  if (exclusionKeywords.length === 0) {
    return {
      isExcluded: false,
      matchedKeywords: [],
      confidence: 0,
      reasoning: 'No exclusion keywords configured'
    };
  }
  
  const { normalized, tokens } = advancedNormalization(payeeName);
  const matchedKeywords: string[] = [];
  const similarities: Array<{ keyword: string; similarity: number; scores: SimilarityScores }> = [];
  
  // Check for exact matches first
  for (const keyword of exclusionKeywords) {
    const normalizedKeyword = keyword.toUpperCase().trim();
    
    // Exact match in normalized name
    if (normalized.includes(normalizedKeyword)) {
      matchedKeywords.push(keyword);
      logger.info(`[ENHANCED EXCLUSION] Exact match found: "${keyword}" in "${payeeName}"`);
      break; // Stop at first match
    }
    
    // Token-level exact match
    if (tokens.some(token => token === normalizedKeyword)) {
      matchedKeywords.push(keyword);
      logger.info(`[ENHANCED EXCLUSION] Token match found: "${keyword}" in "${payeeName}"`);
      break; // Stop at first match
    }
    
    // Fuzzy matching for partial matches
    const similarity = calculateCombinedSimilarity(normalized, normalizedKeyword);
    if (similarity.combined >= 85) { // High similarity threshold for exclusions
      similarities.push({ keyword, similarity: similarity.combined, scores: similarity });
    }
    
    // Check individual tokens for fuzzy matches
    for (const token of tokens) {
      const tokenSimilarity = calculateCombinedSimilarity(token, normalizedKeyword);
      if (tokenSimilarity.combined >= 90) { // Very high threshold for token matches
        similarities.push({ keyword, similarity: tokenSimilarity.combined, scores: tokenSimilarity });
      }
    }
  }
  
  // Add fuzzy matches to matched keywords if no exact matches found
  if (matchedKeywords.length === 0 && similarities.length > 0) {
    // Sort by similarity and take the best match
    similarities.sort((a, b) => b.similarity - a.similarity);
    matchedKeywords.push(similarities[0].keyword);
    logger.info(`[ENHANCED EXCLUSION] Fuzzy match found: "${similarities[0].keyword}" (${similarities[0].similarity.toFixed(1)}%) in "${payeeName}"`);
  }
  
  const isExcluded = matchedKeywords.length > 0;
  const confidence = isExcluded ? Math.max(
    ...similarities.map(s => s.similarity),
    matchedKeywords.length > similarities.length ? 100 : 0 // 100% for exact matches
  ) : 0;
  
  let reasoning = '';
  if (isExcluded) {
    const exactMatches = matchedKeywords.filter(k => 
      !similarities.some(s => s.keyword === k)
    );
    const fuzzyMatches = similarities.filter(s => 
      matchedKeywords.includes(s.keyword)
    ).map(s => `${s.keyword} (${s.similarity.toFixed(1)}% similar)`);
    
    const parts = [];
    if (exactMatches.length > 0) {
      parts.push(`Exact matches: ${exactMatches.join(', ')}`);
    }
    if (fuzzyMatches.length > 0) {
      parts.push(`Fuzzy matches: ${fuzzyMatches.join(', ')}`);
    }
    
    reasoning = `Excluded due to keyword matches - ${parts.join('; ')}`;
  } else {
    reasoning = 'No exclusion keywords matched';
  }
  
  return {
    isExcluded,
    matchedKeywords,
    confidence,
    reasoning
  };
}

/**
 * Bulk keyword exclusion check for batch processing
 */
export function bulkKeywordExclusion(payeeNames: string[]): Map<string, KeywordExclusionResult> {
  const results = new Map<string, KeywordExclusionResult>();
  
  for (const name of payeeNames) {
    results.set(name, checkKeywordExclusion(name));
  }
  
  return results;
}
