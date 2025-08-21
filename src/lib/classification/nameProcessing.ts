import { jaroWinklerSimilarity } from './stringMatching';
import { NAME_SIMILARITY_THRESHOLD } from './config';

// Keep track of similar names for faster lookups
const similarNameCache = new Map<string, string>();

/**
 * Advanced name normalization with extensive cleanup
 */
export function normalizePayeeName(name: string): string {
  if (!name) return '';
  
  let normalized = name
    // Convert to uppercase for consistent comparison
    .toUpperCase()
    // Normalize UTF-8 characters
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Remove common punctuation
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    // Replace multiple spaces with a single space
    .replace(/\s+/g, ' ')
    // Trim leading/trailing whitespace
    .trim();
    
  // Remove common business entity terms
  normalized = normalized
    .replace(/\b(LLC|INC|CORP|LTD|LP|LLP|PC|PLLC)\b\.?$/g, '')
    .replace(/\bCORPORATION\b/g, '')
    .replace(/\bINCORPORATED\b/g, '')
    .replace(/\bLIMITED\b/g, '')
    .replace(/\bCOMPANY\b/g, '')
    .trim();
    
  return normalized;
}

/**
 * Check if two names are similar using fuzzy matching
 */
export function areSimilarNames(name1: string, name2: string): boolean {
  // Normalize both names first
  const normalized1 = normalizePayeeName(name1);
  const normalized2 = normalizePayeeName(name2);
  
  // Exact match after normalization is definitely similar
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Calculate Jaro-Winkler similarity (0-100%)
  const similarity = jaroWinklerSimilarity(normalized1, normalized2);
  
  // Names are similar if similarity is above threshold
  return similarity >= NAME_SIMILARITY_THRESHOLD;
}

/**
 * Get a canonical name for similar payee names (for deduplication)
 */
export function getCanonicalName(name: string): string {
  // First check the cache
  const normalizedName = normalizePayeeName(name);
  
  if (similarNameCache.has(normalizedName)) {
    return similarNameCache.get(normalizedName) as string;
  }
  
  // This is a new canonical name
  similarNameCache.set(normalizedName, name);
  return name;
}

/**
 * Batch name deduplication using fuzzy matching
 */
export function deduplicateNames(names: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const normalized = names.map(name => normalizePayeeName(name));
  
  // First pass - exact matches after normalization
  const exactMatches = new Map<string, string[]>();
  normalized.forEach((norm, i) => {
    if (!exactMatches.has(norm)) {
      exactMatches.set(norm, []);
    }
    exactMatches.get(norm)?.push(names[i]);
  });
  
  // Second pass - fuzzy matching for remaining unique normalized names
  const uniqueNormalized = Array.from(exactMatches.keys());
  
  // Process each unique normalized name
  for (let i = 0; i < uniqueNormalized.length; i++) {
    const currentNorm = uniqueNormalized[i];
    let foundMatch = false;
    
    // Check if this name is similar to any canonical name we've already processed
    for (const [canonicalName, group] of result.entries()) {
      if (areSimilarNames(currentNorm, canonicalName)) {
        // Add all names from this group to the existing canonical group
        exactMatches.get(currentNorm)?.forEach(name => {
          group.push(name);
        });
        foundMatch = true;
        break;
      }
    }
    
    // If no match found, create a new canonical group
    if (!foundMatch) {
      const originalNames = exactMatches.get(currentNorm) || [];
      result.set(currentNorm, [...originalNames]);
    }
  }
  
  return result;
}
