import { logger } from '../logger';

import { ClassificationResult } from '../types';
import { classifyPayeeWithAI } from '../openai/singleClassification';
import { enhancedClassifyPayeeWithAI } from '../openai/enhancedClassification';

/**
 * Classify a single payee using the real OpenAI API
 */
export async function classifyPayee(
  payeeName: string,
  useEnhanced: boolean = false
): Promise<ClassificationResult> {
  logger.info(`Classifying "${payeeName}" with real OpenAI API (enhanced: ${useEnhanced})`);
  
  try {
    if (useEnhanced) {
      // Use enhanced classification with caching and consensus
      const result = await enhancedClassifyPayeeWithAI(payeeName);
      return {
        classification: result.classification,
        confidence: result.confidence,
        reasoning: result.reasoning,
        processingTier: 'AI-Powered',
        matchingRules: result.matchingRules
      };
    } else {
      // Use standard OpenAI classification
      const result = await classifyPayeeWithAI(payeeName);
      return {
        classification: result.classification,
        confidence: result.confidence,
        reasoning: result.reasoning,
        processingTier: 'AI-Powered'
      };
    }
  } catch (error) {
    logger.error(`Error classifying ${payeeName}:`, error);
    throw error;
  }
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 90) return 'Very High';
  if (confidence >= 80) return 'High';
  if (confidence >= 70) return 'Medium';
  if (confidence >= 60) return 'Low';
  return 'Very Low';
}
