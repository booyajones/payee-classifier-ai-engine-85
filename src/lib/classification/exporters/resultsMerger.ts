import { logger } from '../../logger';

import { ExportRow, ExportContext } from './types';
import type { PayeeClassification, OriginalRow } from '../../types';

/**
 * Creates a results map for efficient lookup by row index with validation
 */
export function createResultsMap(results: PayeeClassification[]): Map<number, PayeeClassification> {
  const resultsMap = new Map<number, PayeeClassification>();
  const seenIndices = new Set<number>();
  
  logger.info('[RESULTS MERGER] Creating results map with validation');
  
  results.forEach((result, arrayIndex) => {
    const rowIndex = result.rowIndex;
    
    if (rowIndex === undefined || rowIndex === null) {
      logger.error(`[RESULTS MERGER] CRITICAL: Result at array position ${arrayIndex} has undefined rowIndex:`, result);
      throw new Error(`Result at array position ${arrayIndex} missing rowIndex`);
    }
    
    if (seenIndices.has(rowIndex)) {
      logger.error(`[RESULTS MERGER] CRITICAL: Duplicate rowIndex ${rowIndex} found`);
      throw new Error(`Duplicate rowIndex ${rowIndex} detected in results`);
    }
    
    if (rowIndex !== arrayIndex) {
      logger.error(`[RESULTS MERGER] CRITICAL: Index mismatch - array position ${arrayIndex} has rowIndex ${rowIndex}`);
      throw new Error(`Index mismatch: array position ${arrayIndex} has rowIndex ${rowIndex}`);
    }
    
    seenIndices.add(rowIndex);
    resultsMap.set(rowIndex, result);
  });
  
  logger.info(`[RESULTS MERGER] Successfully created results map with ${resultsMap.size} entries, all perfectly aligned`);
  return resultsMap;
}

/**
 * Merges original row data with AI classification results with perfect alignment
 */
export function mergeRowWithResult(
  originalRow: OriginalRow,
  result: PayeeClassification | undefined,
  index: number,
  includeAllColumns: boolean = true
): ExportRow {
  // Start with ALL original data when requested, otherwise begin with an empty object
  const exportRow: ExportRow = includeAllColumns ? { ...originalRow } : {};

  if (!result) {
    logger.error(`[MERGE] CRITICAL: No result found for row ${index} - this indicates perfect alignment has failed`);
    throw new Error(`Missing result for row ${index} - data alignment corrupted`);
  }

  // Verify perfect alignment
  if (result.rowIndex !== index) {
    logger.error(`[MERGE] CRITICAL: Alignment error - expected rowIndex ${index}, got ${result.rowIndex}`);
    throw new Error(`Data alignment error at row ${index}: expected rowIndex ${index}, got ${result.rowIndex}`);
  }

  logger.info(`[MERGE] Perfect alignment confirmed for row ${index}: "${result.payeeName}"`);

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
  const similarityDetails = [];
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
  exportRow['Processing_Row_Index'] = result.rowIndex;
  
  // Data alignment status - should always be perfect now
  exportRow['Data_Alignment_Status'] = 'Perfect 1:1 Match';

  return exportRow;
}
