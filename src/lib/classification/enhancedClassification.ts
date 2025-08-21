import { ClassificationResult, ClassificationConfig } from '../types';
import { DEFAULT_CLASSIFICATION_CONFIG } from './config';
import { applyRuleBasedClassification } from './ruleBasedClassification';
import { applyNLPClassification } from './nlpClassification';
import { enhancedClassifyPayeeWithAI, consensusClassification } from '../openai/enhancedClassification';
import { detectBusinessByExtendedRules, detectIndividualByExtendedRules, normalizeText } from './enhancedRules';
import { logger } from '../logger';

/**
 * Enhanced classification function that implements a multi-tiered approach
 */
export async function enhancedClassifyPayee(
  payeeName: string,
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG
): Promise<ClassificationResult> {
  if (!payeeName || payeeName.trim() === '') {
    return {
      classification: 'Individual',
      confidence: 0,
      reasoning: "Invalid or empty payee name",
      processingTier: 'Rule-Based'
    };
  }
  
  // Normalize the payee name
  const normalizedName = normalizeText(payeeName);
  
  // Stage 1: Ultra-fast Rule Gate
  const businessCheck = detectBusinessByExtendedRules(payeeName);
  if (businessCheck.isMatch) {
    return {
      classification: 'Business',
      confidence: 99,
      reasoning: `Classified as business based on extended rules: ${businessCheck.rules.join(", ")}`,
      processingTier: 'Rule-Based',
      matchingRules: businessCheck.rules
    };
  }
  
  const individualCheck = detectIndividualByExtendedRules(payeeName);
  if (individualCheck.isMatch) {
    return {
      classification: 'Individual',
      confidence: 97,
      reasoning: `Classified as individual based on extended rules: ${individualCheck.rules.join(", ")}`,
      processingTier: 'Rule-Based',
      matchingRules: individualCheck.rules
    };
  }
  
  // If offline mode, use rule-based classification
  if (config.offlineMode) {
    const isLikelyBusiness = payeeName.split(' ').length > 2 || 
                            /\d/.test(payeeName) || 
                            payeeName.length > 25;
    
    return {
      classification: isLikelyBusiness ? 'Business' : 'Individual',
      confidence: 65,
      reasoning: `Offline classification based on name structure and patterns.`,
      processingTier: 'Rule-Based'
    };
  }
  
  // If bypassing rule-based and NLP, go straight to AI
  if (config.bypassRuleNLP) {
    try {
      const aiResult = await consensusClassification(payeeName, 2);
      return {
        classification: aiResult.classification,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        processingTier: 'AI-Assisted',
        matchingRules: aiResult.matchingRules
      };
    } catch (error) {
      logger.error("Error with AI classification:", error);
      // Fall through to rule-based backup
    }
  }
  
  // Regular tiered approach
  
  // Tier 1: Apply rule-based classification
  const ruleBasedResult = await applyRuleBasedClassification(payeeName);
  if (ruleBasedResult && ruleBasedResult.confidence >= config.aiThreshold) {
    return ruleBasedResult;
  }
  
  // Tier 2: Apply NLP-based classification
  const nlpResult = await applyNLPClassification(payeeName);
  if (nlpResult && nlpResult.confidence >= config.aiThreshold) {
    return nlpResult;
  }
  
  // Tier 3: Apply AI-assisted classification
  try {
    const aiResult = await consensusClassification(payeeName, 2);
    return {
      classification: aiResult.classification,
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      processingTier: 'AI-Assisted',
      matchingRules: aiResult.matchingRules
    };
  } catch (error) {
    logger.error("Error with consensus classification:", error);
    
    // Fallback to single AI classification
    try {
      const result = await enhancedClassifyPayeeWithAI(payeeName);
      return {
        classification: result.classification,
        confidence: result.confidence,
        reasoning: result.reasoning,
        processingTier: 'AI-Assisted',
        matchingRules: result.matchingRules
      };
    } catch (innerError) {
      logger.error("Error with enhanced AI classification:", innerError);
      
      // Last resort: basic heuristic
      return {
        classification: payeeName.split(/\s+/).length <= 2 ? 'Individual' : 'Business',
        confidence: 51,
        reasoning: "Classification based on fallback heuristics due to service errors",
        processingTier: 'Rule-Based'
      };
    }
  }
}
