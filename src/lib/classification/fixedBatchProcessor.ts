import { logger } from '../logger';

import { PayeeClassification, BatchProcessingResult, ClassificationConfig, OriginalRow } from '../types';
import { balancedClassifyPayeeWithAI } from '../openai/balancedClassification';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';
import { processPayeeDeduplicationFixed, createDuplicateResults } from './fixedDeduplication';

/**
 * Fixed batch processor with perfect 1:1 correspondence and no duplication issues
 */
export async function fixedProcessBatch(
  payeeNames: string[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  originalFileData?: OriginalRow[]
): Promise<BatchProcessingResult> {
  const startTime = Date.now();
  
  logger.info(`[FIXED BATCH] Starting batch processing of ${payeeNames.length} payees`);
  logger.info(`[FIXED BATCH] Original file data length: ${originalFileData?.length || 0}`);
  
  // Validate input alignment
  if (originalFileData && originalFileData.length !== payeeNames.length) {
    logger.error(`[FIXED BATCH] CRITICAL: Data misalignment detected! PayeeNames: ${payeeNames.length}, OriginalData: ${originalFileData.length}`);
    throw new Error(`Data alignment error: ${payeeNames.length} names vs ${originalFileData.length} data rows`);
  }
  
  // Process deduplication to find exact duplicates only
  const { processQueue, exactDuplicates } = processPayeeDeduplicationFixed(payeeNames, originalFileData);
  
  logger.info(`[FIXED BATCH] Processing ${processQueue.length} unique names, ${exactDuplicates.size} exact duplicates`);
  
  // Process unique names only
  const results: PayeeClassification[] = [];
  const batchSize = 10; // Smaller batches for better control
  let processedCount = 0;
  
  for (let i = 0; i < processQueue.length; i += batchSize) {
    const batch = processQueue.slice(i, i + batchSize);
    logger.info(`[FIXED BATCH] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(processQueue.length / batchSize)}`);
    
    const batchPromises = batch.map(async (item) => {
      try {
        // Use balanced classification
        const result = await balancedClassifyPayeeWithAI(item.name);
        
        const payeeClassification: PayeeClassification = {
          id: `payee-${item.originalIndex}`,
          payeeName: item.name,
          result: {
            classification: result.classification,
            confidence: result.confidence,
            reasoning: result.reasoning,
            processingTier: 'AI-Assisted',
            processingMethod: 'Balanced AI Classification'
          },
          timestamp: new Date(),
          originalData: item.originalData,
          rowIndex: item.originalIndex
        };
        
        processedCount++;
        if (processedCount % 10 === 0) {
          logger.info(`[FIXED BATCH] Progress: ${processedCount}/${processQueue.length} unique names processed`);
        }
        
        return payeeClassification;
        
      } catch (error) {
        logger.error(`[FIXED BATCH] Error processing "${item.name}" at index ${item.originalIndex}:`, error);
        
        // Create fallback result - no failures allowed
        return {
          id: `payee-${item.originalIndex}`,
          payeeName: item.name,
          result: {
            classification: 'Individual' as const,
            confidence: 25,
            reasoning: `Fallback classification due to processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            processingTier: 'Failed' as const,
            processingMethod: 'Error fallback'
          },
          timestamp: new Date(),
          originalData: item.originalData,
          rowIndex: item.originalIndex
        } as PayeeClassification;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < processQueue.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Create duplicate results based on original classifications
  const duplicateResults = createDuplicateResults(results, exactDuplicates, payeeNames, originalFileData);
  
  // Combine all results
  const allResults = [...results, ...duplicateResults];
  
  // Sort by original row index to maintain perfect order
  allResults.sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));
  
  // Final validation
  if (allResults.length !== payeeNames.length) {
    logger.error(`[FIXED BATCH] CRITICAL: Result count mismatch! Expected: ${payeeNames.length}, Got: ${allResults.length}`);
    throw new Error(`Result alignment error: Expected ${payeeNames.length} results, got ${allResults.length}`);
  }
  
  // Validate each result has correct index
  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i];
    if (result.rowIndex !== i) {
      logger.error(`[FIXED BATCH] CRITICAL: Index mismatch at position ${i}, result has rowIndex ${result.rowIndex}`);
    }
    if (result.payeeName !== payeeNames[i]) {
      logger.warn(`[FIXED BATCH] Name mismatch at index ${i}: expected "${payeeNames[i]}", got "${result.payeeName}"`);
    }
  }
  
  const processingTime = Date.now() - startTime;
  
  // Calculate statistics
  const businessCount = allResults.filter(r => r.result.classification === 'Business').length;
  const individualCount = allResults.filter(r => r.result.classification === 'Individual').length;
  const averageConfidence = allResults.reduce((sum, r) => sum + r.result.confidence, 0) / allResults.length;
  
  logger.info(`[FIXED BATCH] Completed: ${allResults.length} total results`);
  logger.info(`[FIXED BATCH] Classification breakdown: ${businessCount} Business, ${individualCount} Individual`);
  logger.info(`[FIXED BATCH] Business rate: ${((businessCount / allResults.length) * 100).toFixed(1)}%`);
  logger.info(`[FIXED BATCH] Average confidence: ${averageConfidence.toFixed(1)}%`);
  logger.info(`[FIXED BATCH] Processing time: ${processingTime}ms`);
  
  return {
    results: allResults,
    successCount: allResults.length,
    failureCount: 0,
    processingTime,
    originalFileData
  };
}
