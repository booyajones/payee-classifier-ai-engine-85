import { logger } from '../logger';

import { BatchProcessingResult, PayeeClassification } from '../types';

/**
 * Fixed exporter that ensures perfect 1:1 alignment with original data
 * Always preserves original data regardless of file size
 */
export function exportResultsFixed(
  batchResult: BatchProcessingResult,
  includeAllColumns: boolean = true
): any[] {
  logger.info('[FIXED EXPORTER] Starting export with perfect alignment strategy');
  
  if (!batchResult.results) {
    throw new Error('Missing results data for export');
  }
  
  if (!batchResult.originalFileData || batchResult.originalFileData.length === 0) {
    throw new Error('Missing original file data. Original data should always be preserved regardless of file size.');
  }
  
  if (batchResult.originalFileData.length !== batchResult.results.length) {
    throw new Error(`Data length mismatch: ${batchResult.originalFileData.length} original vs ${batchResult.results.length} results`);
  }
  
  logger.info(`[FIXED EXPORTER] Full data export with original file structure for ${batchResult.results.length} rows`);
  const exportData: any[] = [];
  
  for (let i = 0; i < batchResult.originalFileData.length; i++) {
    const originalRow = batchResult.originalFileData[i];
    const result = batchResult.results[i];
    
    // Validate perfect alignment
    if (result.rowIndex !== undefined && result.rowIndex !== i) {
      throw new Error(`Index mismatch at row ${i}: expected ${i}, got ${result.rowIndex}`);
    }
    
    // Create export row with original data first
    const exportRow: any = includeAllColumns ? { ...originalRow } : {};
    
    // Add classification results (matching resultsMerger.ts column names)
    exportRow['AI_Classification'] = result.result.classification;
    exportRow['AI_Confidence_%'] = result.result.confidence;
    exportRow['AI_Processing_Tier'] = result.result.processingTier;
    exportRow['AI_Reasoning'] = result.result.reasoning;
    exportRow['AI_Processing_Method'] = result.result.processingMethod;

    // Keyword exclusion details
    exportRow['Keyword_Exclusion'] = result.result.keywordExclusion?.isExcluded ? 'Yes' : 'No';
    exportRow['Matched_Keywords'] = result.result.keywordExclusion?.matchedKeywords?.join('; ') || '';
    exportRow['Keyword_Confidence_%'] = result.result.keywordExclusion?.confidence || 0;
    exportRow['Keyword_Reasoning'] =
      result.result.keywordExclusion?.reasoning || 'No keyword exclusion applied';

    // Enhanced classification details
    exportRow['Matching_Rules'] = result.result.matchingRules?.join('; ') || '';

    // Similarity scores
    const similarityDetails: string[] = [];
    if (result.result.similarityScores?.levenshtein) {
      similarityDetails.push(
        `Levenshtein: ${result.result.similarityScores.levenshtein}`
      );
    }
    if (result.result.similarityScores?.jaroWinkler) {
      similarityDetails.push(
        `Jaro-Winkler: ${result.result.similarityScores.jaroWinkler}`
      );
    }
    if (result.result.similarityScores?.dice) {
      similarityDetails.push(`Dice: ${result.result.similarityScores.dice}`);
    }
    if (result.result.similarityScores?.tokenSort) {
      similarityDetails.push(
        `Token Sort: ${result.result.similarityScores.tokenSort}`
      );
    }
    if (result.result.similarityScores?.combined) {
      similarityDetails.push(
        `Combined: ${result.result.similarityScores.combined}`
      );
    }
    exportRow['Similarity_Scores'] = similarityDetails.join(' | ') || '';

    // Timestamps and metadata
    exportRow['Classification_Timestamp'] = result.timestamp.toISOString();
    exportRow['Processing_Row_Index'] = result.rowIndex ?? i;
    exportRow['Data_Alignment_Status'] = 'Perfect 1:1 Match';
    
    exportData.push(exportRow);
  }
  
  logger.info(`[FIXED EXPORTER] Successfully exported ${exportData.length} rows with perfect alignment and full data preservation`);
  return exportData;
}

/**
 * Alternative export function that accepts classifications directly
 * This is a fallback that should rarely be used since we always preserve original data
 */
export function exportResultsFromClassifications(
  classifications: PayeeClassification[],
  summary: BatchProcessingResult
): any[] {
  if (summary.originalFileData && summary.originalFileData.length > 0) {
    // Use the main export function when original data is available
    return exportResultsFixed(summary, true);
  }
  
  logger.warn('[FIXED EXPORTER] Fallback export mode - this should not happen in normal operation');
  
  return classifications.map((result, index) => {
    const exportRow: any = {};
    
    // Add from original data if available in the result
    if (result.originalData && Object.keys(result.originalData).length > 0) {
      Object.assign(exportRow, result.originalData);
    } else {
      exportRow['Processing_Row_Index'] = index;
      exportRow['Payee_Name'] = result.payeeName;
    }
    
    // Add classification results
    exportRow['AI_Classification'] = result.result.classification;
    exportRow['AI_Confidence_%'] = result.result.confidence;
    exportRow['AI_Processing_Tier'] = result.result.processingTier;
    exportRow['AI_Reasoning'] = result.result.reasoning;
    exportRow['AI_Processing_Method'] =
      result.result.processingMethod || 'OpenAI Batch API';

    // Keyword exclusion details
    exportRow['Keyword_Exclusion'] = result.result.keywordExclusion?.isExcluded ? 'Yes' : 'No';
    exportRow['Matched_Keywords'] = result.result.keywordExclusion?.matchedKeywords?.join('; ') || '';
    exportRow['Keyword_Confidence_%'] = result.result.keywordExclusion?.confidence || 0;
    exportRow['Keyword_Reasoning'] =
      result.result.keywordExclusion?.reasoning || 'No keyword exclusion applied';

    // Enhanced classification details
    exportRow['Matching_Rules'] = result.result.matchingRules?.join('; ') || '';

    // Similarity scores
    const similarityDetails: string[] = [];
    if (result.result.similarityScores?.levenshtein) {
      similarityDetails.push(
        `Levenshtein: ${result.result.similarityScores.levenshtein}`
      );
    }
    if (result.result.similarityScores?.jaroWinkler) {
      similarityDetails.push(
        `Jaro-Winkler: ${result.result.similarityScores.jaroWinkler}`
      );
    }
    if (result.result.similarityScores?.dice) {
      similarityDetails.push(`Dice: ${result.result.similarityScores.dice}`);
    }
    if (result.result.similarityScores?.tokenSort) {
      similarityDetails.push(
        `Token Sort: ${result.result.similarityScores.tokenSort}`
      );
    }
    if (result.result.similarityScores?.combined) {
      similarityDetails.push(
        `Combined: ${result.result.similarityScores.combined}`
      );
    }
    exportRow['Similarity_Scores'] = similarityDetails.join(' | ') || '';

    // Timestamps and metadata
    exportRow['Classification_Timestamp'] = result.timestamp.toISOString();
    exportRow['Processing_Row_Index'] = result.rowIndex ?? index;
    exportRow['Data_Alignment_Status'] =
      'Fallback Export (original data not preserved - should not happen)';
    
    return exportRow;
  });
}
