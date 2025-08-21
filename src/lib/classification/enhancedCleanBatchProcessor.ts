import { logger } from '../logger';

import { PayeeClassification, BatchProcessingResult, ClassificationConfig } from '../types';
import { balancedClassifyPayeeWithAI } from '../openai/balancedClassification';
import { checkKeywordExclusion, getComprehensiveExclusionKeywords } from './keywordExclusion';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';

export interface ProgressCallback {
  (current: number, total: number, stats: {
    excludedCount: number;
    aiProcessedCount: number;
    errorCount: number;
    processingSpeed?: number;
    estimatedTimeRemaining?: number;
  }): void;
}

export async function enhancedCleanProcessBatch(
  originalFileData: any[],
  selectedColumn: string,
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  onProgress?: ProgressCallback
): Promise<BatchProcessingResult> {
  const startTime = Date.now();
  
  logger.info(`[ENHANCED CLEAN BATCH] Starting enhanced batch processing of ${originalFileData.length} rows using column: ${selectedColumn}`);
  
  if (!originalFileData || originalFileData.length === 0) {
    throw new Error('No data provided for processing');
  }
  
  if (!selectedColumn) {
    throw new Error('No column selected for processing');
  }
  
  const exclusionKeywords = getComprehensiveExclusionKeywords();
  const results: PayeeClassification[] = [];
  let excludedCount = 0;
  let aiProcessedCount = 0;
  let errorCount = 0;
  
  // Initial progress update
  if (onProgress) {
    onProgress(0, originalFileData.length, {
      excludedCount: 0,
      aiProcessedCount: 0,
      errorCount: 0
    });
  }
  
  for (let rowIndex = 0; rowIndex < originalFileData.length; rowIndex++) {
    const rowData = originalFileData[rowIndex];
    
    try {
      const payeeName = String(rowData[selectedColumn] || '').trim();
      
      if (!payeeName || payeeName === '[Empty]') {
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
      
      // Apply keyword exclusion check
      const exclusionResult = checkKeywordExclusion(payeeName, exclusionKeywords);
      
      if (exclusionResult.isExcluded) {
        logger.info(`[ENHANCED CLEAN BATCH] EXCLUDED "${payeeName}" at row ${rowIndex} due to keywords: ${exclusionResult.matchedKeywords.join(', ')}`);
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
      } else {
        // Process with AI
        logger.info(`[ENHANCED CLEAN BATCH] AI processing "${payeeName}" (row ${rowIndex})`);
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
      }
      
    } catch (error) {
      logger.error(`[ENHANCED CLEAN BATCH] Error processing row ${rowIndex}:`, error);
      
      const payeeName = String(rowData[selectedColumn] || '').trim();
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
    
    // Progress update every 5 rows
    if ((rowIndex + 1) % 5 === 0 || rowIndex === originalFileData.length - 1) {
      const currentTime = Date.now();
      const elapsedTime = (currentTime - startTime) / 1000 / 60; // minutes
      const processingSpeed = elapsedTime > 0 ? (rowIndex + 1) / elapsedTime : 0;
      const remainingRows = originalFileData.length - (rowIndex + 1);
      const estimatedTimeRemaining = processingSpeed > 0 ? (remainingRows / processingSpeed) * 60 : 0; // seconds
      
      if (onProgress) {
        onProgress(rowIndex + 1, originalFileData.length, {
          excludedCount,
          aiProcessedCount,
          errorCount,
          processingSpeed,
          estimatedTimeRemaining
        });
      }
    }
    
    // Small delay every 10 rows to prevent rate limiting
    if ((rowIndex + 1) % 10 === 0 && rowIndex + 1 < originalFileData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Validation
  if (results.length !== originalFileData.length) {
    logger.error(`[ENHANCED CLEAN BATCH] CRITICAL: Result count mismatch! Expected: ${originalFileData.length}, Got: ${results.length}`);
    throw new Error(`Result alignment error: Expected ${originalFileData.length} results, got ${results.length}`);
  }
  
  const processingTime = Date.now() - startTime;
  const businessCount = results.filter(r => r.result.classification === 'Business').length;
  const individualCount = results.filter(r => r.result.classification === 'Individual').length;
  const averageConfidence = results.reduce((sum, r) => sum + r.result.confidence, 0) / results.length;
  
  logger.info(`[ENHANCED CLEAN BATCH] ===== PROCESSING COMPLETE =====`);
  logger.info(`[ENHANCED CLEAN BATCH] Total processed: ${results.length} payees`);
  logger.info(`[ENHANCED CLEAN BATCH] Classification breakdown: ${businessCount} Business, ${individualCount} Individual`);
  logger.info(`[ENHANCED CLEAN BATCH] Processing breakdown: ${aiProcessedCount} AI-processed, ${excludedCount} excluded by keywords, ${errorCount} errors`);
  logger.info(`[ENHANCED CLEAN BATCH] Processing time: ${(processingTime / 1000).toFixed(1)} seconds`);
  
  return {
    results,
    successCount: results.length,
    failureCount: 0,
    processingTime,
    originalFileData
  };
}
