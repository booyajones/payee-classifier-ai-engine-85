import { logger } from '../logger';

/**
 * Rule-based classification using probablepeople library and custom rules
 * Enhanced to better detect business names
 */
export async function applyRuleBasedClassification(payeeName: string): Promise<ClassificationResult | null> {
  // Convert to uppercase for consistent matching
  const name = payeeName.toUpperCase();
  const words = name.split(/\s+/);
  const matchingRules: string[] = [];
  let isBusinessIndicator = false;
  let isIndividualIndicator = false;

  // Use probablepeople to parse the name
  try {
    const [parsed, nameType] = await probablepeople.parse(payeeName);
    
    // If probablepeople confidently identifies the type
    if (nameType === 'person') {
      matchingRules.push("Identified as person by name structure analysis");
      isIndividualIndicator = true;
    } else if (nameType === 'corporation') {
      matchingRules.push("Identified as corporation by name structure analysis");
      isBusinessIndicator = true;
    }
  } catch (error) {
    // Parsing failed, continue with other rules
    logger.info("Probablepeople parsing failed, using fallback rules");
  }

  // Check for legal suffixes
  for (const suffix of LEGAL_SUFFIXES) {
    // Check for suffix as a whole word or at the end with punctuation
    const suffixRegex = new RegExp(`\\b${suffix}\\b|\\b${suffix}[.,]?$`, 'i');
    if (suffixRegex.test(name)) {
      matchingRules.push(`Legal suffix: ${suffix}`);
      isBusinessIndicator = true;
      break;
    }
  }

  // Check for business keywords
  for (const keyword of BUSINESS_KEYWORDS) {
    if (name.includes(keyword)) {
      matchingRules.push(`Business keyword: ${keyword}`);
      isBusinessIndicator = true;
      break;
    }
  }

  // Check for industry-specific identifiers
  for (const [industry, keywords] of Object.entries(INDUSTRY_IDENTIFIERS)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        matchingRules.push(`Industry identifier (${industry}): ${keyword}`);
        isBusinessIndicator = true;
        break;
      }
    }
    if (isBusinessIndicator) break;
  }

  // Check for government entity patterns
  for (const pattern of GOVERNMENT_PATTERNS) {
    if (name.includes(pattern)) {
      matchingRules.push(`Government entity pattern: ${pattern}`);
      isBusinessIndicator = true;
      break;
    }
  }

  // Check for professional titles (indicating individuals)
  for (const title of PROFESSIONAL_TITLES) {
    const titleRegex = new RegExp(`\\b${title}\\b|\\b${title}[.,]`, 'i');
    if (titleRegex.test(name)) {
      matchingRules.push(`Professional title: ${title}`);
      isIndividualIndicator = true;
      break;
    }
  }

  // Improved business name detection for common patterns
  // Look for names with industry terms that are often businesses
  const businessTerms = [
    "GRAPHICS", "POOLS", "TRAVEL", "EVENTS", "PLANNERS", "MAINTENANCE", 
    "DISTRIBUTORS", "BAKERY", "CREATIVE", "ENDEAVOR", "MECHANICAL", "PRO", 
    "HVAC", "RESOURCING", "GAS", "LOCAL", "CRUISE", "DESIGNS", "HATCHED", 
    "HOMEBOY", "CITIZEN", "MATTER", "SURFACE", "IMAGE", "CURATED", 
    "ENTERTAINMENT", "AIR", "ADVANCED", "ADMIRAL", "AV", "EXPERT"
  ];
  
  const containsBusinessTerm = businessTerms.some(term => name.includes(term));
  if (containsBusinessTerm) {
    matchingRules.push("Contains common business term");
    isBusinessIndicator = true;
  }
  
  // Check for "LLC" pattern at the end (very strong business indicator)
  if (/LLC\s*$/.test(name)) {
    matchingRules.push("Ends with LLC");
    isBusinessIndicator = true;
  }
  
  // All caps names are often businesses
  if (payeeName === payeeName.toUpperCase() && payeeName.length > 5 && !/[a-z]/.test(payeeName)) {
    matchingRules.push("Name in ALL CAPS (typical of businesses)");
    isBusinessIndicator = true;
  }

  // Simple name pattern detection for individuals
  if (!isBusinessIndicator) {
    const namePattern = /^[A-Za-z]+\s+[A-Za-z]+$/; // Simple First Last pattern
    const nameWithMiddlePattern = /^[A-Za-z]+\s+[A-Za-z]\s+[A-Za-z]+$/; // First Middle Last
    const nameWithMiddleInitialPattern = /^[A-Za-z]+\s+[A-Za-z]\.\s+[A-Za-z]+$/; // First M. Last
    const lastFirstPattern = /^[A-Za-z]+,\s*[A-Za-z]+$/; // Last, First

    if (
      namePattern.test(payeeName) ||
      nameWithMiddlePattern.test(payeeName) ||
      nameWithMiddleInitialPattern.test(payeeName) ||
      lastFirstPattern.test(payeeName)
    ) {
      matchingRules.push("Individual name pattern detected");
      isIndividualIndicator = true;
    }
  }

  // If we have clear indicators, provide a rule-based classification
  if (isBusinessIndicator && !isIndividualIndicator) {
    return {
      classification: 'Business',
      confidence: matchingRules.length > 1 ? 90 : 80,
      reasoning: `Classified as business based on ${matchingRules.join(", ")}`,
      processingTier: 'Rule-Based',
      matchingRules
    };
  } else if (isIndividualIndicator && !isBusinessIndicator) {
    return {
      classification: 'Individual',
      confidence: matchingRules.length > 1 ? 90 : 80,
      reasoning: `Classified as individual based on ${matchingRules.join(", ")}`,
      processingTier: 'Rule-Based',
      matchingRules
    };
  }

  // If conflicting or no clear indicators, return null to try the next tier
  return null;
}
