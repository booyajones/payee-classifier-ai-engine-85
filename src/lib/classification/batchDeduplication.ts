
import { PayeeClassification } from '../types';
import { calculateCombinedSimilarity } from './stringMatching';
import { normalizePayeeName } from './nameProcessing';
import { logger } from '../logger';
import { upsertDedupeLinks } from '../backend';

interface FuzzyMatchResult {
  cached: PayeeClassification;
  canonicalNormalized: string;
  similarity: number;
}

function findFuzzyMatch(
  name: string,
  normalizedName: string,
  duplicateCache: Map<string, PayeeClassification>,
  similarityThreshold: number
): FuzzyMatchResult | null {
  for (const [processedName, cachedResult] of duplicateCache.entries()) {
    const similarity = calculateCombinedSimilarity(normalizedName, processedName).combined;
    if (similarity >= similarityThreshold) {
      logger.debug(
        `[V3 Batch] Fuzzy duplicate found: "${name}" matches "${cachedResult.payeeName}" (${similarity.toFixed(1)}%)`
      );
      return { cached: cachedResult, canonicalNormalized: processedName, similarity };
    }
  }
  return null;
}

/**
 * Process and deduplicate payee names with fuzzy matching
 */
export async function processPayeeDeduplication(
  payeeNames: string[],
  originalFileData?: any[],
  useFuzzyMatching = true,
  similarityThreshold = 90
): Promise<{
  processQueue: Array<{ name: string; normalizedName: string; originalIndex: number; originalData?: any }>;
  results: PayeeClassification[];
  duplicateCache: Map<string, PayeeClassification>;
}> {
  const results: PayeeClassification[] = [];
  const processed = new Set<string>();
  const duplicateCache = new Map<string, PayeeClassification>();
  const processQueue: Array<{ name: string; normalizedName: string; originalIndex: number; originalData?: any }> = [];
  const normalizationCache = new Map<string, string>();
  const dedupeLinks: { canonical_normalized: string; duplicate_normalized: string }[] = [];

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
      const match = findFuzzyMatch(name, normalizedName, duplicateCache, similarityThreshold);
      if (match) {
        results.push({
          ...match.cached,
          id: `${match.cached.id}-fuzzy-${i}`,
          payeeName: name,
          rowIndex: i,
          originalData: originalFileData?.[i],
          result: {
            ...match.cached.result,
            reasoning: `${match.cached.result.reasoning} (Fuzzy match with ${match.similarity.toFixed(1)}% similarity)`,
          },
        });
        dedupeLinks.push({
          canonical_normalized: match.canonicalNormalized,
          duplicate_normalized: normalizedName,
        });
        foundFuzzyMatch = true;
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

  logger.info(
    `[V3 Batch] After deduplication: ${processQueue.length} unique names to process (${payeeNames.length - processQueue.length} duplicates found)`
  );

  await upsertDedupeLinks(dedupeLinks);

  return { processQueue, results, duplicateCache };
}
