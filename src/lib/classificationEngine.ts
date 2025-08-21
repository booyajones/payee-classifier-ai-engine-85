
// This file is maintained for backward compatibility
// It re-exports all functionality from the new module structure

export * from './classification';
export { enhancedClassifyPayee } from './classification/enhancedClassification';
export { enhancedProcessBatch } from './classification/enhancedBatchProcessor';
export { consensusClassification } from './openai/enhancedClassification';
export { getConfidenceLevel, classifyPayee } from './classification/utils';
export { DEFAULT_CLASSIFICATION_CONFIG } from './classification/config';
export { processBatch } from './classification/batchProcessing';

// Export old keyword exclusion functionality for backward compatibility
export { checkKeywordExclusion } from './classification/keywordExclusion';

// Export new enhanced keyword exclusion with different name to avoid conflict
export { 
  checkKeywordExclusion as checkEnhancedKeywordExclusion,
  bulkKeywordExclusion 
} from './classification/enhancedKeywordExclusion';

export * from './openai/batchAPI';

// Export new true batch API functionality
export * from './openai/trueBatchAPI';
export * from './openai/hybridBatchProcessor';

// Export enhanced V2 functions
export { enhancedClassifyPayeeV2 } from './classification/enhancedClassificationV2';
export { enhancedProcessBatchV2, exportResultsWithOriginalData } from './classification/enhancedBatchProcessorV2';

// Export new V3 functions (NO FAILURES, intelligent escalation)
export { enhancedClassifyPayeeV3 } from './classification/enhancedClassificationV3';
export { enhancedProcessBatchV3 } from './classification/enhancedBatchProcessorV3';

// Export comprehensive data exporter - updated to use exporters module
export { exportResultsWithOriginalDataV3 } from './classification/exporters';

// Export string matching functions explicitly to avoid conflicts
export { 
  levenshteinDistance,
  jaroWinklerSimilarity,
  diceCoefficient,
  tokenSortRatio,
  calculateCombinedSimilarity,
  advancedNormalization,
  DEFAULT_SIMILARITY_WEIGHTS
} from './classification/stringMatching';
