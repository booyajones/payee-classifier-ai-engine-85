
import { BatchProcessingResult } from '../types';

/**
 * Fixed exporter that ensures perfect 1:1 alignment with original data
 */
export function exportResultsFixed(
  batchResult: BatchProcessingResult,
  includeAllColumns: boolean = true
): any[] {
  console.log('[FIXED EXPORTER] Starting export with perfect alignment strategy');
  
  if (!batchResult.originalFileData || !batchResult.results) {
    throw new Error('Missing required data for export');
  }
  
  if (batchResult.originalFileData.length !== batchResult.results.length) {
    throw new Error(`Data length mismatch: ${batchResult.originalFileData.length} original vs ${batchResult.results.length} results`);
  }
  
  const exportData: any[] = [];
  
  for (let i = 0; i < batchResult.originalFileData.length; i++) {
    const originalRow = batchResult.originalFileData[i];
    const result = batchResult.results[i];
    
    // Validate alignment
    if (result.rowIndex !== i) {
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
  console.log(`[FIXED EXPORTER] Sample export row:`, exportData[0]);
  
  return exportData;
}
