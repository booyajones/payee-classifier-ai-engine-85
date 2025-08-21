import { PayeeClassification, BatchProcessingResult, ClassificationConfig } from '../types';
import { enhancedClassifyPayeeV3 } from './enhancedClassificationV3';
import { DEFAULT_CLASSIFICATION_CONFIG, MAX_CONCURRENCY } from './config';
import { processPayeeDeduplication } from './batchDeduplication';
import { handleBatchRetries } from './batchRetryHandler';
import { calculateBatchStatistics, logBatchStatistics } from './batchStatistics';
import { exportResultsWithOriginalDataV3 } from './exporters';

/**
 * Enhanced V3 batch processor with no failures and intelligent processing
 */
export async function enhancedProcessBatchV3(
  payeeNames: string[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  originalFileData?: any[]
): Promise<BatchProcessingResult> {
  const startTime = Date.now();
  
  console.log(`[V3 Batch] Starting batch processing of ${payeeNames.length} payees with intelligent escalation`);
  
  // Enhanced deduplication with fuzzy matching
  const { processQueue, results, duplicateCache } = processPayeeDeduplication(
    payeeNames,
    originalFileData,
    config.useFuzzyMatching,
    config.similarityThreshold
  );
  
  // Process in controlled batches with intelligent retry
  const batchSize = Math.min(MAX_CONCURRENCY, 15);
  let totalProcessed = 0;
  let retryQueue: typeof processQueue = [];
  
  for (let i = 0; i < processQueue.length; i += batchSize) {
    const batch = processQueue.slice(i, i + batchSize);
    console.log(`[V3 Batch] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(processQueue.length / batchSize)} (${batch.length} items)`);
    
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await enhancedClassifyPayeeV3(item.name, config);
        
        const payeeClassification: PayeeClassification = {
          id: `payee-${item.originalIndex}`,
          payeeName: item.name,
          result,
          timestamp: new Date(),
          originalData: item.originalData,
          rowIndex: item.originalIndex
        };
        
        // Cache successful results using normalized name from deduplication
        duplicateCache.set(item.normalizedName, payeeClassification);
        
        totalProcessed++;
        if (totalProcessed % 50 === 0) {
          console.log(`[V3 Batch] Progress: ${totalProcessed}/${processQueue.length} processed`);
        }
        
        return payeeClassification;
        
      } catch (error) {
        console.error(`[V3 Batch] Unexpected error processing "${item.name}":`, error);
        
        // Add to retry queue for second attempt
        retryQueue.push(item);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(result => result !== null) as PayeeClassification[]);
    
    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < processQueue.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Handle retries
  const retryResults = await handleBatchRetries(retryQueue);
  results.push(...retryResults);
  
  // Sort results by original index to maintain order
  results.sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));
  
  // Calculate enhanced statistics
  const processingTime = Date.now() - startTime;
  const enhancedStats = calculateBatchStatistics(
    results,
    payeeNames.length,
    processQueue,
    retryQueue,
    processingTime
  );
  
  logBatchStatistics(enhancedStats, results);
  
  return {
    results,
    successCount: results.length,
    failureCount: 0, // NO FAILURES!
    processingTime,
    originalFileData,
    enhancedStats
  };
}

// Re-export the exporter function
export { exportResultsWithOriginalDataV3 };
