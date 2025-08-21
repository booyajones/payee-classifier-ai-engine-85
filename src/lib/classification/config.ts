
import { ClassificationConfig } from '../types';
import { getEnvVar } from '../utils/env';

export { LEGAL_SUFFIXES } from './constants/legalSuffixes';
export { BUSINESS_KEYWORDS } from './constants/businessKeywords';
export { INDUSTRY_IDENTIFIERS } from './constants/industryIdentifiers';
export { GOVERNMENT_PATTERNS } from './constants/governmentPatterns';
export { PROFESSIONAL_TITLES } from './constants/professionalTitles';

// Default classification configuration
export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  aiThreshold: 75, // Default threshold - use AI when confidence is below 75%
  bypassRuleNLP: true, // Always bypass rule-based and NLP classification for accuracy
  useEnhanced: false, // Default to NOT using enhanced classification
  offlineMode: false, // Default to online mode
  useFuzzyMatching: true, // Use fuzzy matching for better results
  useCacheForDuplicates: true // Deduplicate similar names
};

// Version identifier for AI classification prompts
export const promptVersion = '1';

// Increased concurrency limits for better parallel processing
const envConcurrency = parseInt(getEnvVar('CLASSIFIER_MAX_CONCURRENCY', '20'), 10);
export const MAX_CONCURRENCY =
  Number.isFinite(envConcurrency) && envConcurrency > 0 ? envConcurrency : 20; // Doubled from 10

// Maximum batch size for AI classification
const envBatchSize = parseInt(getEnvVar('CLASSIFIER_MAX_BATCH_SIZE', '15'), 10);
export const MAX_BATCH_SIZE =
  Number.isFinite(envBatchSize) && envBatchSize > 0 ? envBatchSize : 15; // Increased from 5

// Extended name similarity threshold (Levenshtein distance %)
export const NAME_SIMILARITY_THRESHOLD = 85; // 85% similar names treated as same
