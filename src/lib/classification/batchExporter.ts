import { BatchProcessingResult, OriginalRow, PayeeClassification } from '../types';
import { normalizePayeeName } from './nameProcessing';
import { calculateCombinedSimilarity } from './stringMatching';
import { logger } from '../logger';

/**
 * Validate that payee names match between results and original data
 */
function validateDataAlignment(
  originalFileData: OriginalRow[],
  results: PayeeClassification[],
  payeeColumnName?: string
): { isValid: boolean; mismatches: Array<{ rowIndex: number; originalName: string; resultName: string }> } {
  const mismatches: Array<{ rowIndex: number; originalName: string; resultName: string }> = [];

  // Try to find the payee column name if not provided
  if (!payeeColumnName && originalFileData.length > 0) {
    const firstRow = originalFileData[0];
    const possibleColumns = Object.keys(firstRow).filter(key =>
      key.toLowerCase().includes('payee') ||
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('supplier') ||
      key.toLowerCase().includes('vendor')
    );
    payeeColumnName = possibleColumns[0];
  }

  if (!payeeColumnName) {
    logger.warn('[BATCH EXPORTER] Could not determine payee column name for validation');
    return { isValid: true, mismatches: [] }; // Skip validation if we can't find the column
  }

  for (let i = 0; i < Math.min(originalFileData.length, results.length); i++) {
    const originalName = originalFileData[i]?.[payeeColumnName];
    const resultName = results[i]?.payeeName;

    if (originalName && resultName && originalName.trim() !== resultName.trim()) {
      mismatches.push({
        rowIndex: i,
        originalName: originalName.trim(),
        resultName: resultName.trim()
      });
    }
  }

  return {
    isValid: mismatches.length === 0,
    mismatches
  };
}

/**
 * Find matching result by payee name (fallback when index matching fails)
 */
export function findResultByName(
  payeeName: string,
  results: PayeeClassification[],
  preferredIndex?: number,
  similarityThreshold: number = 80
): PayeeClassification | null {
  const normalizedTargetName = normalizePayeeName(payeeName);

  // Gather all exact matches
  const exactMatches = results.filter(result => {
    if (!result.payeeName) return false;
    const resultNorm = normalizePayeeName(result.payeeName);
    return resultNorm === normalizedTargetName;
  });

  if (exactMatches.length > 0) {
    if (preferredIndex !== undefined) {
      const preferred = exactMatches.find(r => r.rowIndex === preferredIndex);
      if (preferred) return preferred;
    }
    return exactMatches[0];
  }

  // Gather fuzzy matches using combined similarity
  const fuzzyCandidates = results
    .map(result => {
      if (!result.payeeName) return null;
      const resultNorm = normalizePayeeName(result.payeeName);
      const similarity = calculateCombinedSimilarity(resultNorm, normalizedTargetName).combined;
      return { result, similarity };
    })
    .filter((item): item is { result: any; similarity: number } => !!item && item.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity);

  if (fuzzyCandidates.length > 0) {
    if (preferredIndex !== undefined) {
      const preferred = fuzzyCandidates.find(c => c.result.rowIndex === preferredIndex);
      if (preferred) return preferred.result;
    }
    return fuzzyCandidates[0].result;
  }

  return null;
}
