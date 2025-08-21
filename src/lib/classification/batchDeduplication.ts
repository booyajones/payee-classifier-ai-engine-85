
import { PayeeClassification } from '../types';
import { calculateCombinedSimilarity } from './stringMatching';
import { normalizePayeeName } from './nameProcessing';

/**
 * Process and deduplicate payee names with fuzzy matching
 */
export function processPayeeDeduplication(
  payeeNames: string[],
  originalFileData?: any[],
  useFuzzyMatching = true,
  similarityThreshold = 90
): {
  processQueue: Array<{ name: string; normalizedName: string; originalIndex: number; originalData?: any }>;
  results: PayeeClassification[];
  duplicateCache: Map<string, PayeeClassification>;
} {
  const results: PayeeClassification[] = [];
  const processed = new Set<string>();
  const duplicateCache = new Map<string, PayeeClassification>();
  const processQueue: Array<{ name: string; normalizedName: string; originalIndex: number; originalData?: any }> = [];
  const normalizationCache = new Map<string, string>();

  for (let i = 0; i < payeeNames.length; i++) {
    const name = payeeNames[i].trim();
    if (!name) continue;

    let normalizedName = normalizationCache.get(name);
    if (!normalizedName) {
      normalizedName = normalizePayeeName(name);
      normalizationCache.set(name, normalizedName);
    }

    // Check for exact duplicates
    if (processed.has(normalizedName)) {
      const existingResult = duplicateCache.get(normalizedName);
      if (existingResult) {
        results.push({
          ...existingResult,
          id: `${existingResult.id}-dup-${i}`,
          rowIndex: i,
          originalData: originalFileData?.[i]
        });
        continue;
      }
    }

    // Check for fuzzy duplicates
    let foundFuzzyMatch = false;
    if (useFuzzyMatching) {
      for (const [processedName, cachedResult] of duplicateCache.entries()) {
        const similarity = calculateCombinedSimilarity(normalizedName, processedName);
        if (similarity.combined >= similarityThreshold) {
          console.log(`[V3 Batch] Fuzzy duplicate found: "${name}" matches "${cachedResult.payeeName}" (${similarity.combined.toFixed(1)}%)`);
          results.push({
            ...cachedResult,
            id: `${cachedResult.id}-fuzzy-${i}`,
            payeeName: name, // Keep original name
            rowIndex: i,
            originalData: originalFileData?.[i],
            result: {
              ...cachedResult.result,
              reasoning: `${cachedResult.result.reasoning} (Fuzzy match with ${similarity.combined.toFixed(1)}% similarity)`
            }
          });
          foundFuzzyMatch = true;
          break;
        }
      }
    }

    if (!foundFuzzyMatch) {
      processQueue.push({
        name,
        normalizedName,
        originalIndex: i,
        originalData: originalFileData?.[i]
      });
      processed.add(normalizedName);
    }
  }

  console.log(`[V3 Batch] After deduplication: ${processQueue.length} unique names to process (${payeeNames.length - processQueue.length} duplicates found)`);

  return { processQueue, results, duplicateCache };
}
