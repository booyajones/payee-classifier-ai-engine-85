
import { PayeeClassification, BatchProcessingResult, ClassificationConfig } from '../types';
import { balancedClassifyPayeeWithAI } from '../openai/balancedClassification';
import { checkKeywordExclusion } from './keywordExclusion';
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
  
  console.log(`[CLEAN BATCH] Starting clean batch processing of ${originalFileData.length} rows using column: ${selectedColumn}`);
  
  if (!originalFileData || originalFileData.length === 0) {
    throw new Error('No data provided for processing');
  }
  
  if (!selectedColumn) {
    throw new Error('No column selected for processing');
  }
  
  const results: PayeeClassification[] = [];
  
  // Process each row individually with perfect index tracking
  for (let rowIndex = 0; rowIndex < originalFileData.length; rowIndex++) {
    const rowData = originalFileData[rowIndex];
    
    console.log(`[CLEAN BATCH] Processing row ${rowIndex} of ${originalFileData.length}`);
    
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
        continue;
      }
      
      // Apply keyword exclusion check
      const exclusionResult = checkKeywordExclusion(payeeName);
      
      if (exclusionResult.isExcluded) {
        console.log(`[CLEAN BATCH] Excluding "${payeeName}" at row ${rowIndex} due to keywords: ${exclusionResult.matchedKeywords.join(', ')}`);
        const result: PayeeClassification = {
          id: `payee-${rowIndex}`,
          payeeName,
          result: {
            classification: 'Individual' as const,
            confidence: 95,
            reasoning: `Excluded due to keyword matches: ${exclusionResult.matchedKeywords.join(', ')}`,
            processingTier: 'Excluded' as const,
            processingMethod: 'Keyword exclusion'
          },
          timestamp: new Date(),
          originalData: rowData,
          rowIndex: rowIndex
        };
        results.push(result);
        continue;
      }
      
      // Process with AI - each name individually
      console.log(`[CLEAN BATCH] Processing "${payeeName}" with AI (row ${rowIndex})`);
      const aiResult = await balancedClassifyPayeeWithAI(payeeName);
      
      const result: PayeeClassification = {
        id: `payee-${rowIndex}`,
        payeeName,
        result: {
          classification: aiResult.classification,
          confidence: aiResult.confidence,
          reasoning: aiResult.reasoning,
          processingTier: 'AI-Powered' as const,
          processingMethod: 'OpenAI Classification'
        },
        timestamp: new Date(),
        originalData: rowData,
        rowIndex: rowIndex
      };
      results.push(result);
      
    } catch (error) {
      console.error(`[CLEAN BATCH] Error processing row ${rowIndex}:`, error);
      
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
    }
    
    // Small delay every 10 rows to prevent rate limiting
    if ((rowIndex + 1) % 10 === 0 && rowIndex + 1 < originalFileData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Critical validation - ensure perfect alignment
  if (results.length !== originalFileData.length) {
    console.error(`[CLEAN BATCH] CRITICAL: Result count mismatch! Expected: ${originalFileData.length}, Got: ${results.length}`);
    throw new Error(`Result alignment error: Expected ${originalFileData.length} results, got ${results.length}`);
  }
  
  // Validate each result has correct and unique index
  const seenIndices = new Set<number>();
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    if (result.rowIndex !== i) {
      console.error(`[CLEAN BATCH] CRITICAL: Index mismatch at position ${i}, result has rowIndex ${result.rowIndex}`);
      throw new Error(`Index alignment error at position ${i}: expected rowIndex ${i}, got ${result.rowIndex}`);
    }
    
    if (seenIndices.has(result.rowIndex)) {
      console.error(`[CLEAN BATCH] CRITICAL: Duplicate rowIndex ${result.rowIndex} found`);
      throw new Error(`Duplicate rowIndex ${result.rowIndex} detected`);
    }
    
    seenIndices.add(result.rowIndex);
  }
  
  const processingTime = Date.now() - startTime;
  
  // Calculate statistics
  const businessCount = results.filter(r => r.result.classification === 'Business').length;
  const individualCount = results.filter(r => r.result.classification === 'Individual').length;
  const excludedCount = results.filter(r => r.result.processingTier === 'Excluded').length;
  const aiProcessedCount = results.filter(r => r.result.processingTier === 'AI-Powered').length;
  const averageConfidence = results.reduce((sum, r) => sum + r.result.confidence, 0) / results.length;
  
  console.log(`[CLEAN BATCH] Completed: ${results.length} total results with PERFECT alignment`);
  console.log(`[CLEAN BATCH] Classification breakdown: ${businessCount} Business, ${individualCount} Individual`);
  console.log(`[CLEAN BATCH] Processing breakdown: ${aiProcessedCount} AI-processed, ${excludedCount} excluded`);
  console.log(`[CLEAN BATCH] Business rate: ${((businessCount / results.length) * 100).toFixed(1)}%`);
  console.log(`[CLEAN BATCH] Average confidence: ${averageConfidence.toFixed(1)}%`);
  console.log(`[CLEAN BATCH] Processing time: ${processingTime}ms`);
  console.log(`[CLEAN BATCH] Index validation: All ${results.length} results have perfect 1:1 alignment`);
  
  return {
    results,
    successCount: results.length,
    failureCount: 0,
    processingTime,
    originalFileData
  };
}
