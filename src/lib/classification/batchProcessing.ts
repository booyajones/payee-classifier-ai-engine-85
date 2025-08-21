
import { BatchProcessingResult, ClassificationConfig } from '../types';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';
import { enhancedProcessBatch, BatchProcessorOptions } from './enhancedBatchProcessor';

/**
 * Process a batch of payee names using the enhanced processing system.
 */
export async function processBatch(
  payeeNames: string[],
  onProgress?: (current: number, total: number, percentage: number, stats?: any) => void,
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG
): Promise<BatchProcessingResult> {
  const wrapped = onProgress
    ? (current: number, total: number) => onProgress(current, total, Math.round((current / total) * 100))
    : undefined;

  const options: BatchProcessorOptions = { onProgress: wrapped };
  return enhancedProcessBatch(payeeNames, config, options);
}

// Export the enhanced processor for direct use if needed
export { enhancedProcessBatch };

