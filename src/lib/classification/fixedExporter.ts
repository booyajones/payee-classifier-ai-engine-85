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
    
    // Add classification results
    exportRow['AI_Classification'] = result.result.classification;
    exportRow['AI_Confidence'] = `${result.result.confidence}%`;
    exportRow['AI_Reasoning'] = result.result.reasoning;
    exportRow['Processing_Method'] = result.result.processingMethod;
    exportRow['Processing_Tier'] = result.result.processingTier;
    exportRow['Payee_Name_Used'] = result.payeeName;
    
    // Add keyword exclusion details if it was excluded
    if (result.result.processingTier === 'Excluded') {
      exportRow['Keyword_Excluded'] = 'YES';
      exportRow['Exclusion_Reason'] = result.result.reasoning;
      exportRow['Matched_Keywords'] = result.result.keywordExclusion?.matchedKeywords?.join('; ') || '';
    } else {
      exportRow['Keyword_Excluded'] = 'NO';
      exportRow['Exclusion_Reason'] = 'Not excluded by keywords';
      exportRow['Matched_Keywords'] = '';
    }
    
    // Add processing timestamp
    exportRow['Processed_At'] = result.timestamp.toISOString();
    exportRow['Data_Source'] = 'Full File Processing (original structure preserved)';
    
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
      exportRow['Row_Number'] = index + 1;
      exportRow['Payee_Name'] = result.payeeName;
    }
    
    // Add classification results
    exportRow['AI_Classification'] = result.result.classification;
    exportRow['AI_Confidence'] = `${result.result.confidence}%`;
    exportRow['AI_Reasoning'] = result.result.reasoning;
    exportRow['Processing_Method'] = result.result.processingMethod || 'OpenAI Batch API';
    exportRow['Processing_Tier'] = result.result.processingTier;
    
    // Add keyword exclusion details
    if (result.result.processingTier === 'Excluded') {
      exportRow['Keyword_Excluded'] = 'YES';
      exportRow['Exclusion_Reason'] = result.result.reasoning;
      exportRow['Matched_Keywords'] = result.result.keywordExclusion?.matchedKeywords?.join('; ') || '';
    } else {
      exportRow['Keyword_Excluded'] = 'NO';
      exportRow['Exclusion_Reason'] = 'Not excluded by keywords';
      exportRow['Matched_Keywords'] = '';
    }
    
    // Add processing timestamp
    exportRow['Processed_At'] = result.timestamp.toISOString();
    exportRow['Data_Source'] = 'Fallback Export (original data not preserved - should not happen)';
    
    return exportRow;
  });
}
