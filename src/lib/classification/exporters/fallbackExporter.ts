import { logger } from '../../logger';

import { ExportRow } from './types';

/**
 * Creates export data from results only when no original file data is available
 */
export function createFallbackExportData(results: any[]): ExportRow[] {
  logger.info('[FALLBACK EXPORTER] No original file data, creating export from results only');

  return results.map((result, index) => {
    const exportRow: ExportRow = {
      'Payee_Name': result.payeeName,
      'AI_Classification': result.result.classification,
      'AI_Confidence_%': result.result.confidence,
      'AI_Processing_Tier': result.result.processingTier,
      'AI_Reasoning': result.result.reasoning,
      'AI_Processing_Method': result.result.processingMethod || 'Unknown',
      'Keyword_Exclusion': result.result.keywordExclusion?.isExcluded ? 'Yes' : 'No',
      'Matched_Keywords': result.result.keywordExclusion?.matchedKeywords?.join('; ') || '',
      'Keyword_Confidence_%': result.result.keywordExclusion?.confidence || 0,
      'Keyword_Reasoning': result.result.keywordExclusion?.reasoning || 'No keyword exclusion applied',
      'Matching_Rules': result.result.matchingRules?.join('; ') || '',
      'Similarity_Scores': '',
      'Classification_Timestamp': result.timestamp.toISOString(),
      'Processing_Row_Index': result.rowIndex ?? index,
      'Data_Alignment_Status': 'No Original Data Available'
    };

    const similarityDetails: string[] = [];
    if (result.result.similarityScores?.levenshtein) {
      similarityDetails.push(`Levenshtein: ${result.result.similarityScores.levenshtein}`);
    }
    if (result.result.similarityScores?.jaroWinkler) {
      similarityDetails.push(`Jaro-Winkler: ${result.result.similarityScores.jaroWinkler}`);
    }
    if (result.result.similarityScores?.dice) {
      similarityDetails.push(`Dice: ${result.result.similarityScores.dice}`);
    }
    if (result.result.similarityScores?.tokenSort) {
      similarityDetails.push(`Token Sort: ${result.result.similarityScores.tokenSort}`);
    }
    if (result.result.similarityScores?.combined) {
      similarityDetails.push(`Combined: ${result.result.similarityScores.combined}`);
    }
    exportRow['Similarity_Scores'] = similarityDetails.join(' | ') || '';

    return exportRow;
  });
}
