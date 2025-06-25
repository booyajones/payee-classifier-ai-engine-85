
import { BatchProcessingResult, PayeeClassification } from '../types';

/**
 * Fixed exporter that ensures perfect 1:1 alignment with original data
 * Now handles cases where original data wasn't preserved for large files
 */
export function exportResultsFixed(
  batchResult: BatchProcessingResult,
  includeAllColumns: boolean = true
): any[] {
  console.log('[FIXED EXPORTER] Starting export with perfect alignment strategy');
  
  if (!batchResult.results) {
    throw new Error('Missing results data for export');
  }
  
  const hasOriginalData = batchResult.originalFileData && batchResult.originalFileData.length > 0;
  const isLargeFileExport = !hasOriginalData && batchResult.results.length > 1000;
  
  if (isLargeFileExport) {
    console.log('[FIXED EXPORTER] Large file export mode - original data not preserved');
    return exportLargeFileResults(batchResult.results);
  }
  
  if (!hasOriginalData) {
    console.log('[FIXED EXPORTER] No original data - using results-only export');
    return exportResultsOnly(batchResult.results);
  }
  
  if (batchResult.originalFileData.length !== batchResult.results.length) {
    throw new Error(`Data length mismatch: ${batchResult.originalFileData.length} original vs ${batchResult.results.length} results`);
  }
  
  console.log('[FIXED EXPORTER] Full data export with original file structure');
  const exportData: any[] = [];
  
  for (let i = 0; i < batchResult.originalFileData.length; i++) {
    const originalRow = batchResult.originalFileData[i];
    const result = batchResult.results[i];
    
    // Validate alignment
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
    } else {
      exportRow['Keyword_Excluded'] = 'NO';
      exportRow['Exclusion_Reason'] = 'Not excluded by keywords';
    }
    
    // Add processing timestamp
    exportRow['Processed_At'] = result.timestamp.toISOString();
    
    exportData.push(exportRow);
  }
  
  console.log(`[FIXED EXPORTER] Successfully exported ${exportData.length} rows with perfect alignment`);
  return exportData;
}

/**
 * Export function for large files where original data wasn't preserved
 */
function exportLargeFileResults(results: PayeeClassification[]): any[] {
  console.log(`[FIXED EXPORTER] Large file export - ${results.length} results without original data`);
  
  return results.map((result, index) => {
    const exportRow: any = {};
    
    // Add core payee information
    exportRow['Row_Number'] = index + 1;
    exportRow['Payee_Name'] = result.payeeName;
    
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
    
    // Add processing details
    exportRow['Processed_At'] = result.timestamp.toISOString();
    exportRow['Data_Source'] = 'Large File Processing (original structure not preserved)';
    
    return exportRow;
  });
}

/**
 * Export function for when no original data is available (fallback)
 */
function exportResultsOnly(results: PayeeClassification[]): any[] {
  console.log(`[FIXED EXPORTER] Results-only export - ${results.length} results`);
  
  return results.map((result, index) => {
    const exportRow: any = {};
    
    // Add from original data if available
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
    } else {
      exportRow['Keyword_Excluded'] = 'NO';
      exportRow['Exclusion_Reason'] = 'Not excluded by keywords';
    }
    
    // Add processing timestamp
    exportRow['Processed_At'] = result.timestamp.toISOString();
    
    return exportRow;
  });
}

/**
 * Alternative export function that accepts classifications directly
 */
export function exportResultsFromClassifications(
  classifications: PayeeClassification[],
  summary: BatchProcessingResult
): any[] {
  return exportResultsFixed(summary, true);
}
