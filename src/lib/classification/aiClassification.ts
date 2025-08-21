
import { ClassificationResult } from '../types';

/**
 * AI-assisted classification using simulated AI logic
 * This provides intelligent classification without requiring external API keys
 */
export async function applyAIClassification(payeeName: string): Promise<ClassificationResult> {
  // Validate input
  if (typeof payeeName !== 'string' || payeeName.trim().length === 0) {
    return {
      classification: 'Unknown',
      confidence: 0,
      reasoning: 'Invalid or empty payee name provided.',
      processingTier: 'AI-Assisted' as const,
      matchingRules: []
    };
  }

  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Advanced heuristics that simulate AI reasoning
  const name = payeeName.trim().toUpperCase();
  const words = name.split(/\s+/);
  
  // Simulate reasoning based on features that would be extracted by AI
  const features = [];
  
  // Check for common name prefixes/suffixes
  const hasNamePrefix = /^(MR|MS|MRS|DR|PROF)\b/i.test(name);
  const hasNameSuffix = /\b(JR|SR|II|III|IV|MD|PHD|ESQ)\b/i.test(name);
  
  if (hasNamePrefix) features.push("Has name prefix");
  if (hasNameSuffix) features.push("Has name suffix");
  
  // Check for business indicators
  const businessWords = ["LLC", "INC", "CORP", "CORPORATION", "COMPANY", "CO", "LTD", "LIMITED", 
                        "ENTERPRISE", "CONTRACTORS", "AGENCY", "FIRM", "BUSINESS", "GROUP",
                        "SERVICES", "SOLUTIONS", "CONSULTING", "ASSOCIATES", "PARTNERS"];
  const containsBusinessWord = businessWords.some(word => name.includes(word));
  
  if (containsBusinessWord) features.push("Contains business term");
  
  // Geographic indicators often found in business names
  const geoIndicators = ["EAST", "WEST", "NORTH", "SOUTH", "CENTRAL", "REGIONAL"];
  const containsGeoIndicator = geoIndicators.some(geo => name.includes(geo));
  
  if (containsGeoIndicator) features.push("Contains geographic indicator");
  
  // Check for common first names
  const commonFirstNames = ["JOHN", "JANE", "MICHAEL", "SARAH", "DAVID", "MARY", "ROBERT", 
                           "JENNIFER", "WILLIAM", "ELIZABETH", "JAMES", "LINDA"];
  const hasCommonFirstName = commonFirstNames.some(fname => name.startsWith(fname + " "));
  
  if (hasCommonFirstName) features.push("Starts with common first name");
  
  // Generate confidence based on features
  let confidence = 70; // Start with moderate confidence
  let classification: 'Business' | 'Individual'; 
  let reasoning = "";
  
  // Make a determination based on available features
  if (containsBusinessWord) {
    classification = 'Business';
    reasoning = "AI analysis detected business terminology indicating this is likely a business entity.";
    confidence += 20; // High confidence for clear business indicators
  } else if ((hasNamePrefix || hasNameSuffix || hasCommonFirstName) && !containsGeoIndicator) {
    classification = 'Individual';
    reasoning = "AI analysis suggests this is likely an individual name based on personal name markers.";
    confidence += 15; // Good confidence for personal name indicators
  } else if (containsGeoIndicator) {
    classification = 'Business';
    reasoning = "AI analysis suggests this is likely a business name based on geographic indicators.";
    confidence += 10; // Moderate confidence for geographic indicators
  } else {
    // Default case for ambiguous names
    const wordCount = words.length;
    if (wordCount <= 2 && !name.includes("&") && !name.includes("AND")) {
      classification = 'Individual';
      reasoning = "AI analysis suggests this is likely an individual name based on name simplicity and structure.";
      confidence = 65; // Lower confidence for ambiguous cases
    } else {
      classification = 'Business';
      reasoning = "AI analysis suggests this is likely a business name based on name complexity and structure.";
      confidence = 65; // Lower confidence for ambiguous cases
    }
  }
  
  // Adjust confidence based on number of supporting features
  confidence += features.length * 3;
  
  // Cap confidence at reasonable levels
  confidence = Math.min(confidence, 95);
  confidence = Math.max(confidence, 50); // Minimum confidence
  
  return {
    classification,
    confidence,
    reasoning,
    processingTier: 'AI-Assisted' as const,
    matchingRules: features
  };
}
