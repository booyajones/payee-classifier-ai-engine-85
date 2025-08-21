import { logger } from "../logger";
import { ClassificationConfig } from '@/lib/types';
import { createBatchJob, BatchJob, getBatchJobResults } from './trueBatchAPI';
import { optimizedBatchClassification } from './optimizedBatchClassification';
import { checkKeywordExclusion } from '@/lib/classification/keywordExclusion';

export interface HybridBatchResult {
  results: Array<{
    classification: 'Business' | 'Individual';
    confidence: number;
    reasoning: string;
    processingTier: 'Rule-Based' | 'AI-Powered' | 'Failed' | 'NLP-Based' | 'AI-Assisted' | 'Excluded';
  }>;
  batchJob?: BatchJob;
  stats?: {
    keywordExcluded: number;
    aiProcessed: number;
    phase: string;
  };
}

export interface BatchStats {
  keywordExcluded: number;
  aiProcessed: number;
  phase: string;
}

export type ProgressCallback = (
  current: number,
  total: number,
  percentage: number,
  stats?: BatchStats
) => void;

/**
 * Process payees using either real-time or batch mode
 */
export async function processWithHybridBatch(
  payeeNames: string[],
  mode: 'realtime' | 'batch',
  onProgress?: ProgressCallback,
  config?: ClassificationConfig
): Promise<HybridBatchResult> {
  logger.info(`[HYBRID BATCH] Starting ${mode} processing for ${payeeNames.length} payees`);
  
  const stats: BatchStats = {
    keywordExcluded: 0,
    aiProcessed: 0,
    phase: 'Initializing'
  };

  // Step 1: Apply keyword exclusions first
  stats.phase = 'Applying keyword exclusions';
  onProgress?.(0, payeeNames.length, 0, stats);

  const exclusionResults = payeeNames.map(name =>
    typeof name === 'string' && name.trim()
      ? checkKeywordExclusion(name)
      : { isExcluded: false, matchedKeywords: [], originalName: String(name) }
  );
  
  // Separate excluded vs. needs AI processing
  const needsAI: { name: string; index: number }[] = [];
  const finalResults: Array<{
    classification: 'Business' | 'Individual';
    confidence: number;
    reasoning: string;
    processingTier: 'Rule-Based' | 'AI-Powered' | 'Failed' | 'NLP-Based' | 'AI-Assisted' | 'Excluded';
  } | null> = payeeNames.map((name, index) => {
    const validName = typeof name === 'string' ? name.trim() : '';
    if (!validName) {
      return {
        classification: 'Individual' as const,
        confidence: 0,
        reasoning: 'Invalid payee name',
        processingTier: 'Failed' as const
      };
    }
    const exclusionResult = exclusionResults[index];
    if (exclusionResult.isExcluded) {
      stats.keywordExcluded++;
      return {
        classification: 'Business' as const,
        confidence: 95,
        reasoning: `Excluded by keyword match: ${exclusionResult.matchedKeywords.join(', ')}`,
        processingTier: 'Rule-Based' as const
      };
    } else {
      needsAI.push({ name: validName, index });
      return null; // Placeholder
    }
  });

  logger.info(`[HYBRID BATCH] Keyword exclusions: ${stats.keywordExcluded}, Need AI: ${needsAI.length}`);

  if (needsAI.length === 0) {
    // All were excluded by keywords
    stats.phase = 'Complete - All keyword excluded';
    onProgress?.(payeeNames.length, payeeNames.length, 100, stats);
    return {
      results: finalResults.filter(r => r !== null) as HybridBatchResult['results']
    };
  }

  const aiNames = needsAI.map(item => item.name);

  if (mode === 'batch') {
    // Submit to OpenAI Batch API
    stats.phase = 'Submitting batch job';
    onProgress?.(stats.keywordExcluded, payeeNames.length, (stats.keywordExcluded / payeeNames.length) * 100, stats);

    try {
      logger.info(`[HYBRID BATCH] Creating batch job for ${aiNames.length} names`);
      const batchJob = await createBatchJob(aiNames, `Hybrid classification batch - ${aiNames.length} payees`);
      logger.info(`[HYBRID BATCH] Created batch job:`, batchJob);
      
      stats.phase = 'Batch job submitted';
      stats.aiProcessed = aiNames.length;
      onProgress?.(payeeNames.length, payeeNames.length, 100, stats);

      return {
        results: [], // Results will come later via polling
        batchJob,
        stats
      };
    } catch (error) {
      logger.error('[HYBRID BATCH] Error creating batch job:', error);
      throw new Error(`Failed to create batch job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Real-time processing
    stats.phase = 'Processing with AI (real-time)';
    
    try {
      const aiResults = await optimizedBatchClassification(
        aiNames,
        30000 // timeout
      );

      logger.info(`[HYBRID BATCH] AI processing complete. Results:`, aiResults);

      // Merge AI results back into final results
      needsAI.forEach((item, aiIndex) => {
        const aiResult = aiResults[aiIndex];
        finalResults[item.index] = {
          classification: aiResult?.classification || 'Individual',
          confidence: aiResult?.confidence || 0,
          reasoning: aiResult?.reasoning || 'AI classification failed',
          processingTier: 'AI-Powered' as const
        };
      });

      // Update progress callback
      const processingCallback = (current: number, total: number) => {
        const totalProgress = stats.keywordExcluded + current;
        const percentage = (totalProgress / payeeNames.length) * 100;
        stats.phase = `AI processing: ${current}/${total}`;
        stats.aiProcessed = current;
        onProgress?.(totalProgress, payeeNames.length, percentage, stats);
      };

      stats.phase = 'Complete';
      stats.aiProcessed = aiNames.length;
      onProgress?.(payeeNames.length, payeeNames.length, 100, stats);

      return {
        results: finalResults.filter(r => r !== null) as HybridBatchResult['results'],
        stats
      };
    } catch (error) {
      logger.error('[HYBRID BATCH] Error in real-time processing:', error);
      throw new Error(`Real-time processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Complete a batch job by retrieving and processing results
 */
export async function completeBatchJob(
  batchJob: BatchJob,
  originalPayeeNames: string[]
): Promise<HybridBatchResult> {
  logger.info(`[HYBRID BATCH] Completing batch job ${batchJob.id} for ${originalPayeeNames.length} payees`);
  
  // Re-apply keyword exclusions to get the same filtering
  const exclusionResults = originalPayeeNames.map(name => checkKeywordExclusion(name));
  const needsAI: { name: string; index: number }[] = [];
  const finalResults: Array<{
    classification: 'Business' | 'Individual';
    confidence: number;
    reasoning: string;
    processingTier: 'Rule-Based' | 'AI-Powered' | 'Failed' | 'NLP-Based' | 'AI-Assisted' | 'Excluded';
  } | null> = originalPayeeNames.map((name, index) => {
    const exclusionResult = exclusionResults[index];
    if (exclusionResult.isExcluded) {
      return {
        classification: 'Business' as const,
        confidence: 95,
        reasoning: `Excluded by keyword match: ${exclusionResult.matchedKeywords.join(', ')}`,
        processingTier: 'Rule-Based' as const
      };
    } else {
      needsAI.push({ name, index });
      return null;
    }
  });

  if (needsAI.length === 0) {
    return {
      results: finalResults.filter(r => r !== null) as HybridBatchResult['results']
    };
  }

  const aiNames = needsAI.map(item => item.name);
  
  try {
    logger.info(`[HYBRID BATCH] Retrieving batch results for ${aiNames.length} AI-processed names`);
    const batchResults = await getBatchJobResults(batchJob, aiNames);
    
    // Merge batch results back into final results
    needsAI.forEach((item, aiIndex) => {
      const batchResult = batchResults[aiIndex];
      finalResults[item.index] = {
        classification: batchResult?.classification || 'Individual',
        confidence: batchResult?.confidence || 0,
        reasoning: batchResult?.reasoning || 'Batch processing failed',
        processingTier: batchResult?.status === 'success' ? 'AI-Powered' as const : 'Failed' as const
      };
    });

    logger.info(`[HYBRID BATCH] Batch job completion successful`);

    return {
      results: finalResults.filter(r => r !== null) as HybridBatchResult['results'],
      stats: {
        keywordExcluded: originalPayeeNames.length - needsAI.length,
        aiProcessed: needsAI.length,
        phase: 'Complete'
      }
    };
  } catch (error) {
    logger.error('[HYBRID BATCH] Error completing batch job:', error);
    throw new Error(`Failed to complete batch job: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
