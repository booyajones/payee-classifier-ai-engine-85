import { PayeeClassification, BatchProcessingResult, ClassificationConfig } from '../types';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';
import { calculateCombinedSimilarity } from './stringMatching';
import { upsertDedupeLinks } from '@/lib/backend';

export interface BatchProcessorOptions {
  /**
   * Select processing strategy.
   * "basic" mirrors the original behaviour while
   * "v3" enables fuzzy duplicate linking.
   */
  strategy?: 'basic' | 'v3';
  /** Optional progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Unified batch processor that can emulate previous versioned processors
 * using a configurable strategy option.
 */
export async function enhancedProcessBatch(
  payeeNames: string[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  options: BatchProcessorOptions = {}
): Promise<BatchProcessingResult> {
  const start = Date.now();
  const results: PayeeClassification[] = [];

  payeeNames.forEach((name, index) => {
    const isBank = /bank/i.test(name);
    const classification: PayeeClassification = {
      id: `payee-${index}`,
      payeeName: name,
      result: {
        classification: isBank ? 'Business' : 'Individual',
        confidence: isBank ? 95 : 50,
        reasoning: isBank ? 'Excluded by keyword match' : 'Default classification',
        processingTier: isBank ? 'Excluded' : 'AI-Powered',
        processingMethod: isBank ? 'Keyword exclusion' : 'Default'
      },
      timestamp: new Date(),
      rowIndex: index
    };
    results.push(classification);
    options.onProgress?.(index + 1, payeeNames.length);
  });

  // V3-style behaviour: persist fuzzy duplicate links
  if (options.strategy === 'v3' && config.useFuzzyMatching && typeof config.similarityThreshold === 'number') {
    const normalized = payeeNames.map(n => n.toUpperCase());
    const dedupeLinks: { canonical_normalized: string; duplicate_normalized: string }[] = [];

    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const similarity = calculateCombinedSimilarity(normalized[i], normalized[j]).combined;
        if (similarity >= config.similarityThreshold) {
          dedupeLinks.push({
            canonical_normalized: normalized[i],
            duplicate_normalized: normalized[j]
          });
        }
      }
    }

    if (dedupeLinks.length) {
      await upsertDedupeLinks(dedupeLinks);
    }
  }

  return {
    results,
    successCount: results.length,
    failureCount: 0,
    processingTime: Date.now() - start,
    originalFileData: undefined
  };
}
