
export interface ClassificationResult {
  classification: 'Business' | 'Individual';
  confidence: number;
  reasoning: string;
  processingTier: 'Rule-Based' | 'NLP-Based' | 'AI-Assisted' | 'AI-Powered' | 'Excluded' | 'Failed';
  matchingRules?: string[];
  similarityScores?: SimilarityScores;
  keywordExclusion?: KeywordExclusionResult;
  processingMethod?: string;
}

export interface SimilarityScores {
  levenshtein: number;
  jaroWinkler: number;
  dice: number;
  tokenSort: number;
  combined: number;
}

export interface SimilarityWeights {
  levenshtein: number;
  jaroWinkler: number;
  dice: number;
  tokenSort: number;
}

export interface KeywordExclusionResult {
  isExcluded: boolean;
  matchedKeywords: string[];
  confidence: number;
  reasoning: string;
}

export interface PayeeClassification {
  id: string;
  payeeName: string;
  result: ClassificationResult;
  timestamp: Date;
  originalData?: any; // For preserving original file data
  rowIndex?: number; // For maintaining order from original file
}

export interface BatchProcessingResult {
  results: PayeeClassification[];
  successCount: number;
  failureCount: number;
  processingTime?: number;
  originalFileData?: any[]; // Preserve original file structure
  enhancedStats?: EnhancedBatchStatistics;
}

export interface ParsedPerson {
  GivenName?: string;
  FirstInitial?: string;
  Surname?: string;
  LastInitial?: string;
  SuffixGenerational?: string;
  SuffixOther?: string;
  PrefixMarital?: string;
  PrefixOther?: string;
  MiddleName?: string;
  MiddleInitial?: string;
  [key: string]: string | undefined;
}

export interface ParsedCorporation {
  CorporationName?: string;
  CorporationLegalType?: string;
  OrganizationNameType?: string;
  [key: string]: string | undefined;
}

export interface ClassificationConfig {
  aiThreshold: number;
  bypassRuleNLP: boolean;
  useEnhanced?: boolean;
  offlineMode?: boolean;
  useFuzzyMatching?: boolean;
  useCacheForDuplicates?: boolean;
  similarityThreshold?: number; // For fuzzy matching
  similarityWeights?: SimilarityWeights; // Weights for similarity algorithms
  retryFailedClassifications?: boolean;
  maxRetries?: number;
}

export interface EnhancedBatchStatistics {
  totalProcessed: number;
  businessCount: number;
  individualCount: number;
  excludedCount: number;
  failedCount: number;
  averageConfidence: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  processingTierCounts: Record<string, number>;
  processingTime: number;
  deduplicationSavings?: number;
  cacheSavings?: number;
  retryCount?: number;
  similarityStats?: {
    averageLevenshtein: number;
    averageJaroWinkler: number;
    averageDice: number;
    averageTokenSort: number;
  };
}
