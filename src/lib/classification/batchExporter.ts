
import { BatchProcessingResult } from '../types';
import { normalizePayeeName } from './nameProcessing';

/**
 * Validate that payee names match between results and original data
 */
function validateDataAlignment(
  originalFileData: any[],
  results: any[],
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
    console.warn('[BATCH EXPORTER] Could not determine payee column name for validation');
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
export function findResultByName(payeeName: string, results: any[], preferredIndex?: number): any | null {
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

  // Gather fuzzy matches (contains)
  const fuzzyMatches = results.filter(result => {
    if (!result.payeeName) return false;
    const resultNorm = normalizePayeeName(result.payeeName);
    return resultNorm.includes(normalizedTargetName) || normalizedTargetName.includes(resultNorm);
  });

  if (fuzzyMatches.length > 0) {
    if (preferredIndex !== undefined) {
      const preferred = fuzzyMatches.find(r => r.rowIndex === preferredIndex);
      if (preferred) return preferred;
    }
    return fuzzyMatches[0];
  }

  return null;
}

// Backward-compatible export for main exporter
export { exportResultsWithOriginalDataV3 } from './exporters';
