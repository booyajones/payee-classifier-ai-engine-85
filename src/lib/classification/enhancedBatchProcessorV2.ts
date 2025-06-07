
import { PayeeClassification, BatchProcessingResult, ClassificationConfig, EnhancedBatchStatistics } from '../types';
import { enhancedClassifyPayeeV2 } from './enhancedClassificationV2';
import { deduplicateNames } from './nameProcessing';
import { bulkKeywordExclusion } from './enhancedKeywordExclusion';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';

export interface BatchRow {
  payeeName: string;
  originalData: any;
  rowIndex: number;
}

/**
 * Enhanced batch processor with failure recovery and original data preservation
 */
export async function enhancedProcessBatchV2(
  rows: BatchRow[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  onProgress?: (processed: number, total: number, current: string) => void,
  payeeColumnName?: string
): Promise<BatchProcessingResult> {
  const startTime = Date.now();
  const results: PayeeClassification[] = [];
  const failedItems: { row: BatchRow; error: string; retryCount: number }[] = [];
  
  console.log(`Starting enhanced batch processing of ${rows.length} items`);
  
  // Step 1: Bulk keyword exclusion check
  const payeeNames = rows.map(row => row.payeeName);
  const keywordExclusions = bulkKeywordExclusion(payeeNames);
  
  // Step 2: Deduplication if enabled
  let processedRows = rows;
  const deduplicationMap = new Map<string, BatchRow[]>();
  
  if (config.useCacheForDuplicates) {
    const nameGroups = deduplicateNames(payeeNames);
    processedRows = [];
    
    nameGroups.forEach((originalNames, canonicalName) => {
      const canonicalRow = rows.find(row => row.payeeName === originalNames[0]);
      if (canonicalRow) {
        processedRows.push(canonicalRow);
        deduplicationMap.set(canonicalName, rows.filter(row => 
          originalNames.includes(row.payeeName)
        ));
      }
    });
    
    console.log(`Deduplication: ${rows.length} -> ${processedRows.length} unique names`);
  }
  
  // Step 3: Process each unique item
  for (let i = 0; i < processedRows.length; i++) {
    const row = processedRows[i];
    
    try {
      onProgress?.(i + 1, processedRows.length, row.payeeName);
      
      const result = await enhancedClassifyPayeeV2(row.payeeName, {
        ...config,
        retryFailedClassifications: true,
        maxRetries: 2
      });
      
      const classification: PayeeClassification = {
        id: `${Date.now()}-${i}`,
        payeeName: row.payeeName,
        result,
        timestamp: new Date(),
        originalData: row.originalData,
        rowIndex: row.rowIndex
      };
      
      results.push(classification);
      
      // If this was a deduplicated item, apply same result to all duplicates
      if (config.useCacheForDuplicates) {
        const duplicates = deduplicationMap.get(row.payeeName) || [];
        duplicates.slice(1).forEach(dupRow => {
          const dupClassification: PayeeClassification = {
            id: `${Date.now()}-${dupRow.rowIndex}`,
            payeeName: dupRow.payeeName,
            result: {
              ...result,
              reasoning: `${result.reasoning} (Applied from similar name: ${row.payeeName})`
            },
            timestamp: new Date(),
            originalData: dupRow.originalData,
            rowIndex: dupRow.rowIndex
          };
          results.push(dupClassification);
        });
      }
      
    } catch (error) {
      console.error(`Failed to classify "${row.payeeName}":`, error);
      
      failedItems.push({
        row,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      });
    }
  }
  
  // Step 4: Retry failed items
  const maxRetries = 2;
  for (let retry = 0; retry < maxRetries && failedItems.length > 0; retry++) {
    console.log(`Retry attempt ${retry + 1} for ${failedItems.length} failed items`);
    
    const toRetry = [...failedItems];
    failedItems.length = 0;
    
    for (const { row, error, retryCount } of toRetry) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // Exponential backoff
        
        const result = await enhancedClassifyPayeeV2(row.payeeName, {
          ...config,
          retryFailedClassifications: false // Avoid infinite retry loops
        });
        
        const classification: PayeeClassification = {
          id: `${Date.now()}-retry-${row.rowIndex}`,
          payeeName: row.payeeName,
          result: {
            ...result,
            reasoning: `${result.reasoning} (Succeeded on retry ${retry + 1})`
          },
          timestamp: new Date(),
          originalData: row.originalData,
          rowIndex: row.rowIndex
        };
        
        results.push(classification);
        
      } catch (retryError) {
        failedItems.push({
          row,
          error: retryError instanceof Error ? retryError.message : 'Unknown retry error',
          retryCount: retryCount + 1
        });
      }
    }
  }
  
  // Step 5: Handle remaining failures with fallback classification
  for (const { row, error } of failedItems) {
    console.warn(`Final fallback for failed item: ${row.payeeName}`);
    
    const fallbackClassification: PayeeClassification = {
      id: `${Date.now()}-fallback-${row.rowIndex}`,
      payeeName: row.payeeName,
      result: {
        classification: 'Individual', // Conservative fallback
        confidence: 25,
        reasoning: `Classification failed after retries: ${error}. Defaulted to Individual.`,
        processingTier: 'Failed',
        processingMethod: 'Final fallback'
      },
      timestamp: new Date(),
      originalData: row.originalData,
      rowIndex: row.rowIndex
    };
    
    results.push(fallbackClassification);
  }
  
  // Step 6: Sort results by original row index to maintain order
  results.sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));
  
  // Step 7: Calculate enhanced statistics
  const endTime = Date.now();
  const processingTime = endTime - startTime;
  
  const enhancedStats: EnhancedBatchStatistics = {
    totalProcessed: results.length,
    businessCount: results.filter(r => r.result.classification === 'Business').length,
    individualCount: results.filter(r => r.result.classification === 'Individual').length,
    excludedCount: results.filter(r => r.result.processingTier === 'Excluded').length,
    failedCount: results.filter(r => r.result.processingTier === 'Failed').length,
    averageConfidence: results.reduce((sum, r) => sum + r.result.confidence, 0) / results.length,
    highConfidenceCount: results.filter(r => r.result.confidence >= 80).length,
    mediumConfidenceCount: results.filter(r => r.result.confidence >= 60 && r.result.confidence < 80).length,
    lowConfidenceCount: results.filter(r => r.result.confidence < 60).length,
    processingTierCounts: results.reduce((counts, r) => {
      counts[r.result.processingTier] = (counts[r.result.processingTier] || 0) + 1;
      return counts;
    }, {} as Record<string, number>),
    processingTime,
    deduplicationSavings: config.useCacheForDuplicates ? rows.length - processedRows.length : 0,
    retryCount: maxRetries,
    similarityStats: calculateSimilarityStats(results)
  };
  
  console.log(`Batch processing completed: ${results.length} items in ${processingTime}ms`);
  
  return {
    results,
    successCount: results.filter(r => r.result.processingTier !== 'Failed').length,
    failureCount: results.filter(r => r.result.processingTier === 'Failed').length,
    payeeColumnName,
    processingTime,
    originalFileData: rows.map(row => row.originalData),
    enhancedStats
  };
}

/**
 * Calculate similarity statistics for the batch
 */
function calculateSimilarityStats(results: PayeeClassification[]) {
  const withSimilarity = results.filter(r => r.result.similarityScores);
  
  if (withSimilarity.length === 0) {
    return {
      averageLevenshtein: 0,
      averageJaroWinkler: 0,
      averageDice: 0,
      averageTokenSort: 0
    };
  }
  
  return {
    averageLevenshtein: withSimilarity.reduce((sum, r) => sum + (r.result.similarityScores?.levenshtein || 0), 0) / withSimilarity.length,
    averageJaroWinkler: withSimilarity.reduce((sum, r) => sum + (r.result.similarityScores?.jaroWinkler || 0), 0) / withSimilarity.length,
    averageDice: withSimilarity.reduce((sum, r) => sum + (r.result.similarityScores?.dice || 0), 0) / withSimilarity.length,
    averageTokenSort: withSimilarity.reduce((sum, r) => sum + (r.result.similarityScores?.tokenSort || 0), 0) / withSimilarity.length
  };
}

/**
 * Export results with original file data preserved
 */
export function exportResultsWithOriginalData(
  results: PayeeClassification[],
  originalHeaders: string[] = []
): any[] {
  return results.map(result => {
    const exportRow: any = {};
    
    // Include original data if available
    if (result.originalData) {
      Object.assign(exportRow, result.originalData);
    }
    
    // Add classification results
    exportRow['Classification'] = result.result.classification;
    exportRow['Confidence'] = result.result.confidence;
    exportRow['Processing_Tier'] = result.result.processingTier;
    exportRow['Reasoning'] = result.result.reasoning;
    exportRow['Processing_Method'] = result.result.processingMethod;
    
    // Add keyword exclusion details if available
    if (result.result.keywordExclusion) {
      exportRow['Keyword_Excluded'] = result.result.keywordExclusion.isExcluded;
      exportRow['Matched_Keywords'] = result.result.keywordExclusion.matchedKeywords.join('; ');
    }
    
    // Add similarity scores if available
    if (result.result.similarityScores) {
      exportRow['Similarity_Combined'] = result.result.similarityScores.combined.toFixed(1);
      exportRow['Similarity_Levenshtein'] = result.result.similarityScores.levenshtein.toFixed(1);
      exportRow['Similarity_JaroWinkler'] = result.result.similarityScores.jaroWinkler.toFixed(1);
    }
    
    // Add matching rules if available
    if (result.result.matchingRules) {
      exportRow['Matching_Rules'] = result.result.matchingRules.join('; ');
    }
    
    exportRow['Classification_Timestamp'] = result.timestamp.toISOString();
    
    return exportRow;
  });
}
