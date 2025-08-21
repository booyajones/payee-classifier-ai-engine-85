import { logger } from '../../logger';

import { ExportRow } from './types';

/**
 * Creates export data from results only when no original file data is available
 */
export function createFallbackExportData(results: any[]): ExportRow[] {
  logger.info('[FALLBACK EXPORTER] No original file data, creating export from results only');
  
  return results.map(result => ({
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
    'Classification_Timestamp': result.timestamp.toISOString(),
    'Row_Index': result.rowIndex || 0
  }));
}
