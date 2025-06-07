import { BatchProcessingResult } from '../types';

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
  const normalizedTargetName = payeeName.trim().toLowerCase();

  // Gather all exact matches
  const exactMatches = results.filter(result =>
    result.payeeName && result.payeeName.trim().toLowerCase() === normalizedTargetName
  );

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
    const resultName = result.payeeName.trim().toLowerCase();
    return resultName.includes(normalizedTargetName) || normalizedTargetName.includes(resultName);
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

/**
 * Export results with original file data for V3 - ENHANCED WITH VALIDATION
 */
export function exportResultsWithOriginalDataV3(
  batchResult: BatchProcessingResult,
  includeAllColumns: boolean = true
): any[] {
  console.log('[BATCH EXPORTER] Processing batch result:', {
    hasOriginalData: !!batchResult.originalFileData,
    originalDataLength: batchResult.originalFileData?.length || 0,
    resultsLength: batchResult.results.length,
    sampleOriginalData: batchResult.originalFileData?.slice(0, 1)
  });

  if (!batchResult.originalFileData || batchResult.originalFileData.length === 0) {
    console.log('[BATCH EXPORTER] No original file data, creating comprehensive export from results only');
    return batchResult.results.map(result => ({
      'Payee_Name': result.payeeName,
      'Classification': result.result.classification,
      'Confidence_%': result.result.confidence,
      'Processing_Tier': result.result.processingTier,
      'Reasoning': result.result.reasoning,
      'Processing_Method': result.result.processingMethod || 'Unknown',
      'Keyword_Exclusion': result.result.keywordExclusion?.isExcluded ? 'Yes' : 'No',
      'Matched_Keywords': result.result.keywordExclusion?.matchedKeywords?.join('; ') || '',
      'Keyword_Confidence_%': result.result.keywordExclusion?.confidence || 0,
      'Keyword_Reasoning': result.result.keywordExclusion?.reasoning || 'No keyword exclusion applied',
      'Matching_Rules': result.result.matchingRules?.join('; ') || '',
      'Levenshtein_Score': result.result.similarityScores?.levenshtein || '',
      'Jaro_Winkler_Score': result.result.similarityScores?.jaroWinkler || '',
      'Dice_Coefficient': result.result.similarityScores?.dice || '',
      'Token_Sort_Ratio': result.result.similarityScores?.tokenSort || '',
      'Combined_Similarity': result.result.similarityScores?.combined || '',
      'Classification_Timestamp': result.timestamp.toISOString(),
      'Row_Index': result.rowIndex || 0
    }));
  }

  // Validate data alignment first
  const firstOriginalRow = batchResult.originalFileData[0];
  const payeeColumnName = batchResult.payeeColumnName || (firstOriginalRow ? Object.keys(firstOriginalRow).find(key =>
    key.toLowerCase().includes('payee') ||
    key.toLowerCase().includes('name') ||
    key.toLowerCase().includes('supplier') ||
    key.toLowerCase().includes('vendor')
  ) : undefined);

  const validation = validateDataAlignment(
    batchResult.originalFileData,
    batchResult.results,
    payeeColumnName
  );

  if (!validation.isValid && validation.mismatches.length > 0) {
    console.warn('[BATCH EXPORTER] Data alignment issues detected:', validation.mismatches.slice(0, 5));
    console.warn(`[BATCH EXPORTER] Total mismatches: ${validation.mismatches.length}/${batchResult.originalFileData.length}`);
  }

  console.log('[BATCH EXPORTER] Merging original data with classification results using enhanced validation');

  return batchResult.originalFileData.map((originalRow, index) => {
    // Start with ALL original data
    const exportRow: any = { ...originalRow };

    // First try to find result by row index
    let result = batchResult.results.find(r => r.rowIndex === index);

    // If not found by index, try to find by payee name (fallback)
    if (!result && payeeColumnName) {
      const originalPayeeName = originalRow[payeeColumnName];
      if (originalPayeeName) {
        result = findResultByName(originalPayeeName, batchResult.results, index);
        if (result) {
          console.log(`[BATCH EXPORTER] Used name-based fallback matching for row ${index}: "${originalPayeeName}" -> "${result.payeeName}"`);
        }
      }
    }

    console.log(`[BATCH EXPORTER] Processing row ${index}:`, {
      hasResult: !!result,
      originalRowKeys: Object.keys(originalRow),
      resultPayeeName: result?.payeeName,
      originalPayeeName: payeeColumnName ? originalRow[payeeColumnName] : 'unknown',
      usedFallback: result && result.rowIndex !== index
    });

    if (!result) {
      console.log('[BATCH EXPORTER] No result found for row index:', index, 'using fallback');
      // Add classification columns with fallback values
      exportRow['AI_Classification'] = 'Individual';
      exportRow['AI_Confidence_%'] = 50;
      exportRow['AI_Processing_Tier'] = 'Failed';
      exportRow['AI_Reasoning'] = 'Result not found - processing failed';
      exportRow['AI_Processing_Method'] = 'Emergency fallback';
      exportRow['Keyword_Exclusion'] = 'No';
      exportRow['Matched_Keywords'] = '';
      exportRow['Keyword_Confidence_%'] = 0;
      exportRow['Keyword_Reasoning'] = 'No result found';
      exportRow['Matching_Rules'] = '';
      exportRow['Similarity_Scores'] = '';
      exportRow['Classification_Timestamp'] = new Date().toISOString();
      exportRow['Processing_Row_Index'] = index;
      exportRow['Data_Alignment_Status'] = 'Missing Result';
      return exportRow;
    }

    // Add all AI classification data as NEW columns
    exportRow['AI_Classification'] = result.result.classification;
    exportRow['AI_Confidence_%'] = result.result.confidence;
    exportRow['AI_Processing_Tier'] = result.result.processingTier;
    exportRow['AI_Reasoning'] = result.result.reasoning;
    exportRow['AI_Processing_Method'] = result.result.processingMethod || 'OpenAI Batch API';

    // Keyword exclusion details
    exportRow['Keyword_Exclusion'] = result.result.keywordExclusion?.isExcluded ? 'Yes' : 'No';
    exportRow['Matched_Keywords'] = result.result.keywordExclusion?.matchedKeywords?.join('; ') || '';
    exportRow['Keyword_Confidence_%'] = result.result.keywordExclusion?.confidence || 0;
    exportRow['Keyword_Reasoning'] = result.result.keywordExclusion?.reasoning || 'No keyword exclusion applied';

    // Enhanced classification details
    exportRow['Matching_Rules'] = result.result.matchingRules?.join('; ') || '';

    // Similarity scores
    const similarityDetails: string[] = [];
    if (result.result.similarityScores?.levenshtein) {
      similarityDetails.push(`Levenshtein: ${result.result.similarityScores.levenshtein}`);
    }
    if (result.result.similarityScores?.jaroWinkler) {
      similarityDetails.push(`Jaro-Winkler: ${result.result.similarityScores.jaroWinkler}`);
    }
    if (result.result.similarityScores?.dice) {
      similarityDetails.push(`Dice: ${result.result.similarityScores.dice}`);
    }
    if (result.result.similarityScores?.tokenSort) {
      similarityDetails.push(`Token Sort: ${result.result.similarityScores.tokenSort}`);
    }
    if (result.result.similarityScores?.combined) {
      similarityDetails.push(`Combined: ${result.result.similarityScores.combined}`);
    }
    exportRow['Similarity_Scores'] = similarityDetails.join(' | ') || '';

    // Timestamps and metadata
    exportRow['Classification_Timestamp'] = result.timestamp.toISOString();
    exportRow['Processing_Row_Index'] = result.rowIndex || index;

    // Data alignment status
    const originalPayeeName = payeeColumnName ? originalRow[payeeColumnName] : '';
    const namesMatch = originalPayeeName && result.payeeName &&
      originalPayeeName.trim().toLowerCase() === result.payeeName.trim().toLowerCase();
    const indexMatch = result.rowIndex === index;

    if (indexMatch && namesMatch) {
      exportRow['Data_Alignment_Status'] = 'Perfect Match';
    } else if (namesMatch) {
      exportRow['Data_Alignment_Status'] = 'Name Match (Index Mismatch)';
    } else if (indexMatch) {
      exportRow['Data_Alignment_Status'] = 'Index Match (Name Mismatch)';
    } else {
      exportRow['Data_Alignment_Status'] = 'Fallback Match';
    }

    console.log(`[BATCH EXPORTER] Final merged row ${index} with ${Object.keys(exportRow).length} columns, alignment: ${exportRow['Data_Alignment_Status']}`);
    return exportRow;
  });
}

export { exportResultsWithOriginalDataV3 };
