import { logger } from '../logger';

import { ClassificationResult, ClassificationConfig, SimilarityScores } from '../types';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';
import { checkKeywordExclusion } from './enhancedKeywordExclusion';
import { calculateCombinedSimilarity, advancedNormalization, levenshteinSimilarity } from './stringMatching';
import { normalizePayeeName } from './nameProcessing';
import { applyRuleBasedClassification } from './ruleBasedClassification';
import { applyNLPClassification } from './nlpClassification';
import { consensusClassification } from '../openai/enhancedClassification';
import { detectBusinessByExtendedRules, detectIndividualByExtendedRules } from './enhancedRules';

// Hard-coded confidence thresholds for intelligent escalation
const CONFIDENCE_THRESHOLDS = {
  HIGH_CONFIDENCE: 95,
  MEDIUM_CONFIDENCE: 85,
  REVIEW_REQUIRED: 75,
  ESCALATE_TO_AI: 65,
  FORCE_WEB_SEARCH: 50
};

// Business entity indicators for advanced detection
const BUSINESS_INDICATORS = [
  'LLC', 'INC', 'CORP', 'LTD', 'CO', 'COMPANY', 'CORPORATION', 'ENTERPRISES',
  'GROUP', 'HOLDINGS', 'PARTNERS', 'ASSOCIATES', 'SERVICES', 'SOLUTIONS',
  'AGENCY', 'STUDIO', 'CONSULTING', 'MANAGEMENT', 'SYSTEMS', 'TECHNOLOGIES',
  'GRAPHICS', 'POOLS', 'TRAVEL', 'EVENTS', 'PLANNERS', 'MAINTENANCE',
  'DISTRIBUTORS', 'BAKERY', 'CREATIVE', 'ENDEAVOR', 'MECHANICAL', 'PRO',
  'HVAC', 'RESOURCING', 'GAS', 'LOCAL', 'CRUISE', 'DESIGNS', 'HATCHED',
  'HOMEBOY', 'CITIZEN', 'MATTER', 'SURFACE', 'IMAGE', 'CURATED',
  'ENTERTAINMENT', 'AIR', 'ADVANCED', 'ADMIRAL', 'AV', 'EXPERT'
];

const INDIVIDUAL_INDICATORS = [
  'DR', 'MR', 'MRS', 'MS', 'JR', 'SR', 'III', 'IV', 'ESQ', 'MD', 'PHD',
  'PROF', 'REV', 'PASTOR', 'RABBI'
];

/**
 * Extract comprehensive features for entity classification
 */
function extractEntityFeatures(payeeName: string): {
  businessScore: number;
  individualScore: number;
  confidence: number;
  indicators: string[];
  structuralFeatures: any;
} {
  const { normalized, tokens, businessIndicators, individualIndicators } = advancedNormalization(payeeName);
  const words = payeeName.split(/\s+/);
  const indicators: string[] = [];
  
  let businessScore = 0;
  let individualScore = 0;
  
  // Exact business indicator matches
  const exactBusinessMatches = BUSINESS_INDICATORS.filter(indicator =>
    normalized.includes(indicator)
  );
  businessScore += exactBusinessMatches.length * 25;
  indicators.push(...exactBusinessMatches.map(match => `Business indicator: ${match}`));
  
  // Exact individual indicator matches
  const exactIndividualMatches = INDIVIDUAL_INDICATORS.filter(indicator =>
    normalized.includes(indicator)
  );
  individualScore += exactIndividualMatches.length * 30;
  indicators.push(...exactIndividualMatches.map(match => `Individual indicator: ${match}`));
  
  // Structural analysis
  const structuralFeatures = {
    wordCount: words.length,
    hasNumbers: /\d/.test(payeeName),
    hasSpecialChars: /[&@#$%]/.test(payeeName),
    isAllCaps: payeeName === payeeName.toUpperCase() && payeeName.length > 5,
    hasAmpersand: payeeName.includes('&'),
    hasPossessive: /'\s*s\b/.test(payeeName),
    avgWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
    startsWithThe: /^the\s+/i.test(payeeName),
    hasComma: payeeName.includes(',')
  };
  
  // Business structural scoring
  if (structuralFeatures.wordCount > 3) {
    businessScore += 15;
    indicators.push('Multi-word business pattern');
  }
  
  if (structuralFeatures.hasNumbers) {
    businessScore += 10;
    indicators.push('Contains numbers');
  }
  
  if (structuralFeatures.hasAmpersand) {
    businessScore += 20;
    indicators.push('Contains ampersand');
  }
  
  if (structuralFeatures.isAllCaps) {
    businessScore += 15;
    indicators.push('All caps formatting');
  }
  
  if (payeeName.length > 30) {
    businessScore += 10;
    indicators.push('Long name pattern');
  }
  
  // Individual structural scoring
  if (structuralFeatures.wordCount === 2 && !structuralFeatures.hasNumbers) {
    individualScore += 20;
    indicators.push('Two-word personal name pattern');
  }
  
  if (structuralFeatures.wordCount === 3 && !structuralFeatures.hasNumbers) {
    individualScore += 15;
    indicators.push('Three-word personal name pattern');
  }
  
  if (structuralFeatures.hasPossessive) {
    individualScore += 25;
    indicators.push('Possessive form (individual proprietor)');
  }
  
  if (structuralFeatures.hasComma && structuralFeatures.wordCount === 2) {
    individualScore += 20;
    indicators.push('Last, First name format');
  }
  
  // Calculate confidence based on score differential
  const maxScore = Math.max(businessScore, individualScore);
  const minScore = Math.min(businessScore, individualScore);
  const scoreDifferential = maxScore - minScore;
  const confidence = Math.min(95, Math.max(50, maxScore + scoreDifferential / 2));
  
  return {
    businessScore,
    individualScore,
    confidence,
    indicators,
    structuralFeatures
  };
}

/**
 * Advanced fuzzy matching against cached results
 */
async function performAdvancedFuzzyMatching(payeeName: string): Promise<ClassificationResult | null> {
  try {
    const cachedClassifications = JSON.parse(localStorage.getItem('payeeClassifications') || '{}');
    const cachedNames = Object.keys(cachedClassifications);
    
    if (cachedNames.length === 0) return null;
    
    // Normalize payee name once for comparison
    const normalizedPayee = normalizePayeeName(payeeName);

    // Calculate similarities using multiple algorithms on normalized names
    const similarities = cachedNames.map(cachedName => {
      const normalizedCached = normalizePayeeName(cachedName);
      const scores = calculateCombinedSimilarity(normalizedPayee, normalizedCached);
      return {
        name: cachedName,
        scores,
        result: cachedClassifications[cachedName]
      };
    }).filter(match => match.scores.combined >= CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED);
    
    if (similarities.length === 0) return null;
    
    // Get best match with highest combined similarity
    const bestMatch = similarities.sort((a, b) => b.scores.combined - a.scores.combined)[0];
    
    if (bestMatch.scores.combined >= CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE) {
      return {
        classification: bestMatch.result.result.classification,
        confidence: Math.min(bestMatch.scores.combined, CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE),
        reasoning: `High-confidence fuzzy match between "${payeeName}" and "${bestMatch.name}" (${bestMatch.scores.combined.toFixed(1)}% similarity)`,
        processingTier: 'Rule-Based',
        similarityScores: bestMatch.scores,
        processingMethod: 'Advanced fuzzy matching'
      };
    }
    
    return null;
  } catch (error) {
    logger.warn('Advanced fuzzy matching failed:', error);
    return null;
  }
}

/**
 * Multi-algorithm heuristic classification with confidence scoring
 */
function performMultiAlgorithmClassification(payeeName: string): ClassificationResult {
  const features = extractEntityFeatures(payeeName);
  const { businessScore, individualScore, confidence, indicators } = features;
  
  // Determine classification based on scores
  const classification = businessScore > individualScore ? 'Business' : 'Individual';
  const dominantScore = Math.max(businessScore, individualScore);
  
  // Adjust confidence based on score strength and indicators
  let adjustedConfidence = Math.min(CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE, 
    confidence + (indicators.length * 2));
  
  // Boost confidence for very clear cases
  if (dominantScore > 50 && indicators.length >= 3) {
    adjustedConfidence = Math.min(CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE, adjustedConfidence + 10);
  }
  
  return {
    classification,
    confidence: adjustedConfidence,
    reasoning: `Multi-algorithm classification (Business: ${businessScore}, Individual: ${individualScore}). Key indicators: ${indicators.slice(0, 3).join(', ')}`,
    processingTier: 'Rule-Based',
    matchingRules: indicators,
    processingMethod: 'Multi-algorithm heuristic analysis'
  };
}

/**
 * Web search enhanced AI classification for difficult cases
 */
async function performWebSearchClassification(payeeName: string): Promise<ClassificationResult> {
  try {
    // Use consensus classification with web search capability
    const aiResult = await consensusClassification(payeeName, 3); // Use 3 attempts for difficult cases
    
    return {
      classification: aiResult.classification,
      confidence: Math.max(aiResult.confidence, CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED), // Ensure minimum confidence
      reasoning: `Web-search enhanced AI classification: ${aiResult.reasoning}`,
      processingTier: 'AI-Powered',
      matchingRules: aiResult.matchingRules,
      processingMethod: 'Web-search enhanced consensus AI'
    };
  } catch (error) {
    logger.error('Web search classification failed:', error);
    
    // Fall back to multi-algorithm classification
    const fallbackResult = performMultiAlgorithmClassification(payeeName);
    return {
      ...fallbackResult,
      confidence: Math.max(fallbackResult.confidence, CONFIDENCE_THRESHOLDS.FORCE_WEB_SEARCH),
      reasoning: `${fallbackResult.reasoning} (AI web search unavailable, using enhanced heuristics)`,
      processingMethod: 'Fallback multi-algorithm (AI unavailable)'
    };
  }
}

/**
 * Enhanced V3 classification with intelligent escalation - NO FAILURES ALLOWED
 */
export async function enhancedClassifyPayeeV3(
  payeeName: string,
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  retryCount: number = 0
): Promise<ClassificationResult> {
  if (!payeeName || payeeName.trim() === '') {
    // Even invalid names get a classification
    return {
      classification: 'Individual',
      confidence: CONFIDENCE_THRESHOLDS.FORCE_WEB_SEARCH,
      reasoning: "Invalid or empty payee name - defaulting to Individual with minimum confidence",
      processingTier: 'Rule-Based',
      processingMethod: 'Input validation fallback'
    };
  }

  try {
    logger.info(`[V3] Classifying "${payeeName}" with intelligent escalation...`);

    // Stage 1: Keyword exclusion check
    const keywordExclusion = checkKeywordExclusion(payeeName);
    if (keywordExclusion.isExcluded) {
      return {
        classification: 'Business',
        confidence: Math.max(keywordExclusion.confidence, CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE),
        reasoning: keywordExclusion.reasoning,
        processingTier: 'Excluded',
        keywordExclusion,
        processingMethod: 'Keyword exclusion'
      };
    }

    // Stage 2: Ultra-fast rule-based detection
    const businessCheck = detectBusinessByExtendedRules(payeeName);
    if (businessCheck.isMatch) {
      const confidence = Math.min(CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE, 
        CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE + businessCheck.rules.length * 3);
      
      if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE) {
        return {
          classification: 'Business',
          confidence,
          reasoning: `High-confidence business detection: ${businessCheck.rules.join(", ")}`,
          processingTier: 'Rule-Based',
          matchingRules: businessCheck.rules,
          processingMethod: 'Extended business rules'
        };
      }
    }

    const individualCheck = detectIndividualByExtendedRules(payeeName);
    if (individualCheck.isMatch) {
      const confidence = Math.min(CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE, 
        CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE + individualCheck.rules.length * 4);
      
      if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE) {
        return {
          classification: 'Individual',
          confidence,
          reasoning: `High-confidence individual detection: ${individualCheck.rules.join(", ")}`,
          processingTier: 'Rule-Based',
          matchingRules: individualCheck.rules,
          processingMethod: 'Extended individual rules'
        };
      }
    }

    // Stage 3: Advanced fuzzy matching
    const fuzzyResult = await performAdvancedFuzzyMatching(payeeName);
    if (fuzzyResult && fuzzyResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE) {
      return fuzzyResult;
    }

    // Stage 4: Multi-algorithm heuristic analysis
    const heuristicResult = performMultiAlgorithmClassification(payeeName);
    
    // If we have high confidence, return the result
    if (heuristicResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM_CONFIDENCE) {
      return heuristicResult;
    }

    // Stage 5: Standard AI classification
    if (!config.offlineMode) {
      try {
        const aiResult = await consensusClassification(payeeName, 2);
        
        // If AI gives us good confidence, use it
        if (aiResult.confidence >= CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED) {
          return {
            classification: aiResult.classification,
            confidence: aiResult.confidence,
            reasoning: aiResult.reasoning,
            processingTier: 'AI-Assisted',
            matchingRules: aiResult.matchingRules,
            processingMethod: 'Standard AI consensus'
          };
        }
        
        // If AI confidence is low, escalate to web search
        if (aiResult.confidence < CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED) {
          logger.info(`[V3] Low AI confidence (${aiResult.confidence}%), escalating to web search for "${payeeName}"`);
          return await performWebSearchClassification(payeeName);
        }
        
      } catch (error) {
        logger.warn(`[V3] Standard AI classification failed for "${payeeName}":`, error);
        // Continue to web search escalation
      }
    }

    // Stage 6: Web search enhanced classification (when system needs to look harder)
    logger.info(`[V3] Escalating to web search classification for "${payeeName}"`);
    return await performWebSearchClassification(payeeName);

  } catch (error) {
    logger.error(`[V3] Unexpected error classifying "${payeeName}":`, error);
    
    // ABSOLUTE FALLBACK - NO FAILURES ALLOWED
    const emergencyResult = performMultiAlgorithmClassification(payeeName);
    return {
      ...emergencyResult,
      confidence: Math.max(emergencyResult.confidence, CONFIDENCE_THRESHOLDS.FORCE_WEB_SEARCH),
      reasoning: `${emergencyResult.reasoning} (Emergency fallback due to system error)`,
      processingMethod: 'Emergency multi-algorithm fallback'
    };
  }
}
