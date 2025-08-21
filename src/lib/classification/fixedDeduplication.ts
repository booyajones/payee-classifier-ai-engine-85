import { logger } from '../logger';

import { PayeeClassification } from '../types';

/**
 * Fixed deduplication that maintains perfect 1:1 correspondence
 */
export function processPayeeDeduplicationFixed(
  payeeNames: string[],
  originalFileData?: any[]
): {
  processQueue: Array<{ name: string; originalIndex: number; originalData?: any }>;
  exactDuplicates: Map<string, number>; // Maps duplicate names to their first occurrence index
} {
  const processQueue: Array<{ name: string; originalIndex: number; originalData?: any }> = [];
  const exactDuplicates = new Map<string, number>();
  const seenNames = new Map<string, number>(); // Map normalized name to first occurrence index

  logger.info(`[FIXED DEDUP] Processing ${payeeNames.length} payee names for exact duplicates only`);

  for (let i = 0; i < payeeNames.length; i++) {
    const name = payeeNames[i]?.trim();
    if (!name) {
      logger.warn(`[FIXED DEDUP] Empty name at index ${i}, skipping`);
      continue;
    }

    // Simple normalization - just trim and lowercase for exact matching
    const normalizedName = name.toLowerCase().trim();

    if (seenNames.has(normalizedName)) {
      const firstIndex = seenNames.get(normalizedName)!;
      exactDuplicates.set(`${i}`, firstIndex);
      logger.info(`[FIXED DEDUP] Exact duplicate found: "${name}" at index ${i} matches first occurrence at index ${firstIndex}`);
    } else {
      // First occurrence of this name
      seenNames.set(normalizedName, i);
      processQueue.push({
        name,
        originalIndex: i,
        originalData: originalFileData?.[i]
      });
    }
  }

  logger.info(`[FIXED DEDUP] Result: ${processQueue.length} unique names to process, ${exactDuplicates.size} exact duplicates found`);
  
  return { processQueue, exactDuplicates };
}

/**
 * Create duplicate results based on the original classification
 */
export function createDuplicateResults(
  originalResults: PayeeClassification[],
  exactDuplicates: Map<string, number>,
  payeeNames: string[],
  originalFileData?: any[]
): PayeeClassification[] {
  const duplicateResults: PayeeClassification[] = [];
  
  for (const [duplicateIndexStr, originalIndex] of exactDuplicates.entries()) {
    const duplicateIndex = parseInt(duplicateIndexStr);
    const originalResult = originalResults.find(r => r.rowIndex === originalIndex);
    
    if (originalResult) {
      const duplicateResult: PayeeClassification = {
        id: `payee-${duplicateIndex}-duplicate`,
        payeeName: payeeNames[duplicateIndex],
        result: {
          ...originalResult.result,
          reasoning: `${originalResult.result.reasoning} (Exact duplicate of classification at row ${originalIndex})`
        },
        timestamp: new Date(),
        originalData: originalFileData?.[duplicateIndex],
        rowIndex: duplicateIndex
      };
      
      duplicateResults.push(duplicateResult);
      logger.info(`[FIXED DEDUP] Created duplicate result for index ${duplicateIndex} based on original at ${originalIndex}`);
    }
  }
  
  return duplicateResults;
}
