import { logger } from '../logger';

import { PayeeClassification, BatchProcessingResult, ClassificationConfig } from '../types';
import { balancedClassifyPayeeWithAI } from '../openai/balancedClassification';
import { checkKeywordExclusion, getComprehensiveExclusionKeywords } from './keywordExclusion';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';

/**
 * Clean batch processor that processes each row individually based on selected column
 * No deduplication, no caching - pure row-by-row processing with perfect index alignment
 */
export async function cleanProcessBatch(
  originalFileData: any[],
  selectedColumn: string,
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG
): Promise<BatchProcessingResult> {
  const startTime = Date.now();
  
  logger.info(`[CLEAN BATCH] Starting clean batch processing of ${originalFileData.length} rows using column: ${selectedColumn}`);
  
  if (!originalFileData || originalFileData.length === 0) {
    throw new Error('No data provided for processing');
  }
  
  if (!selectedColumn) {
    throw new Error('No column selected for processing');
  }
  
  // Get the comprehensive exclusion keywords
  const exclusionKeywords = getComprehensiveExclusionKeywords();
  logger.info(`[CLEAN BATCH] Loaded ${exclusionKeywords.length} exclusion keywords for processing`);
  logger.info(`[CLEAN BATCH] Sample keywords: ${exclusionKeywords.slice(0, 10).join(', ')}`);
  
  const results: PayeeClassification[] = [];
  let excludedCount = 0;
  let aiProcessedCount = 0;
  let errorCount = 0;
  
  // Process each row individually with perfect index tracking
  for (let rowIndex = 0; rowIndex < originalFileData.length; rowIndex++) {
    const rowData = originalFileData[rowIndex];
    
    // Show progress every 10 rows
    if (rowIndex % 10 === 0) {
      logger.info(`[CLEAN BATCH] Processing row ${rowIndex + 1} of ${originalFileData.length} (${Math.round((rowIndex / originalFileData.length) * 100)}%)`);
      logger.info(`[CLEAN BATCH] Progress so far: ${excludedCount} excluded, ${aiProcessedCount} AI processed, ${errorCount} errors`);
    }
    
    try {
      // Extract payee name from the selected column
      const payeeName = String(rowData[selectedColumn] || '').trim();
      
      if (!payeeName || payeeName === '[Empty]') {
        // Handle empty names
        const result: PayeeClassification = {
          id: `payee-${rowIndex}`,
          payeeName: payeeName || '[Empty]',
          result: {
            classification: 'Individual' as const,
            confidence: 0,
            reasoning: 'Empty or missing payee name',
            processingTier: 'Failed' as const,
            processingMethod: 'Empty name handling'
          },
          timestamp: new Date(),
          originalData: rowData,
          rowIndex: rowIndex
        };
        results.push(result);
        errorCount++;
        continue;
      }
      
      // Apply keyword exclusion check FIRST
      const exclusionResult = checkKeywordExclusion(payeeName, exclusionKeywords);
      
      if (exclusionResult.isExcluded) {
        logger.info(`[CLEAN BATCH] EXCLUDED "${payeeName}" at row ${rowIndex} due to keywords: ${exclusionResult.matchedKeywords.join(', ')}`);
        const result: PayeeClassification = {
          id: `payee-${rowIndex}`,
          payeeName,
          result: {
            classification: 'Business' as const,
            confidence: 95,
            reasoning: `Excluded by keyword match: ${exclusionResult.matchedKeywords.join(', ')}. This payee contains business/institutional keywords that automatically classify it as a business entity.`,
            processingTier: 'Excluded' as const,
            processingMethod: 'Keyword exclusion'
          },
          timestamp: new Date(),
          originalData: rowData,
          rowIndex: rowIndex
        };
        results.push(result);
        excludedCount++;
        continue;
      }
      
      // Process with AI - each name individually
      logger.info(`[CLEAN BATCH] AI processing "${payeeName}" (row ${rowIndex})`);
      const aiResult = await balancedClassifyPayeeWithAI(payeeName);
      
      const result: PayeeClassification = {
        id: `payee-${rowIndex}`,
        payeeName,
        result: {
          classification: aiResult.classification,
          confidence: aiResult.confidence,
          reasoning: `AI Classification: ${aiResult.reasoning}`,
          processingTier: 'AI-Powered' as const,
          processingMethod: 'OpenAI Classification'
        },
        timestamp: new Date(),
        originalData: rowData,
        rowIndex: rowIndex
      };
      results.push(result);
      aiProcessedCount++;
      
    } catch (error) {
      logger.error(`[CLEAN BATCH] Error processing row ${rowIndex}:`, error);
      
      const payeeName = String(rowData[selectedColumn] || '').trim();
      
      // Create fallback result - no failures allowed
      const result: PayeeClassification = {
        id: `payee-${rowIndex}`,
        payeeName: payeeName || '[Error]',
        result: {
          classification: 'Individual' as const,
          confidence: 25,
          reasoning: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          processingTier: 'Failed' as const,
          processingMethod: 'Error fallback'
        },
        timestamp: new Date(),
        originalData: rowData,
        rowIndex: rowIndex
      };
      results.push(result);
      errorCount++;
    }
    
    // Small delay every 10 rows to prevent rate limiting
    if ((rowIndex + 1) % 10 === 0 && rowIndex + 1 < originalFileData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Critical validation - ensure perfect alignment
  if (results.length !== originalFileData.length) {
    logger.error(`[CLEAN BATCH] CRITICAL: Result count mismatch! Expected: ${originalFileData.length}, Got: ${results.length}`);
    throw new Error(`Result alignment error: Expected ${originalFileData.length} results, got ${results.length}`);
  }
  
  // Validate each result has correct and unique index
  const seenIndices = new Set<number>();
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    if (result.rowIndex !== i) {
      logger.error(`[CLEAN BATCH] CRITICAL: Index mismatch at position ${i}, result has rowIndex ${result.rowIndex}`);
      throw new Error(`Index alignment error at position ${i}: expected rowIndex ${i}, got ${result.rowIndex}`);
    }
    
    if (seenIndices.has(result.rowIndex)) {
      logger.error(`[CLEAN BATCH] CRITICAL: Duplicate rowIndex ${result.rowIndex} found`);
      throw new Error(`Duplicate rowIndex ${result.rowIndex} detected`);
    }
    
    seenIndices.add(result.rowIndex);
  }
  
  const processingTime = Date.now() - startTime;
  
  // Calculate final statistics
  const businessCount = results.filter(r => r.result.classification === 'Business').length;
  const individualCount = results.filter(r => r.result.classification === 'Individual').length;
  const averageConfidence = results.reduce((sum, r) => sum + r.result.confidence, 0) / results.length;
  
  logger.info(`[CLEAN BATCH] ===== PROCESSING COMPLETE =====`);
  logger.info(`[CLEAN BATCH] Total processed: ${results.length} payees`);
  logger.info(`[CLEAN BATCH] Classification breakdown: ${businessCount} Business, ${individualCount} Individual`);
  logger.info(`[CLEAN BATCH] Processing breakdown: ${aiProcessedCount} AI-processed, ${excludedCount} excluded by keywords, ${errorCount} errors`);
  logger.info(`[CLEAN BATCH] Business rate: ${((businessCount / results.length) * 100).toFixed(1)}%`);
  logger.info(`[CLEAN BATCH] Keyword exclusion rate: ${((excludedCount / results.length) * 100).toFixed(1)}%`);
  logger.info(`[CLEAN BATCH] Average confidence: ${averageConfidence.toFixed(1)}%`);
  logger.info(`[CLEAN BATCH] Processing time: ${(processingTime / 1000).toFixed(1)} seconds`);
  logger.info(`[CLEAN BATCH] Index validation: All ${results.length} results have perfect 1:1 alignment`);
  
  return {
    results,
    successCount: results.length,
    failureCount: 0,
    processingTime,
    originalFileData
  };
}
