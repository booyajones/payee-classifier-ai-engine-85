import { describe, it, expect } from 'vitest';
import { exportResultsFixed } from '@/lib/classification/fixedExporter';
import {
  exportResultsWithOriginalDataV3,
  createFallbackExportData
} from '@/lib/classification/exporters';

const baseResult = {
  payeeName: 'Acme LLC',
  result: {
    classification: 'Business',
    confidence: 95,
    reasoning: 'reason',
    processingTier: 'AI-Powered',
    processingMethod: 'OpenAI',
    keywordExclusion: {
      isExcluded: false,
      matchedKeywords: [],
      confidence: 0,
      reasoning: 'No keyword exclusion applied'
    },
    matchingRules: ['rule1'],
    similarityScores: { levenshtein: 0.8 }
  },
  timestamp: new Date('2024-01-01T00:00:00Z'),
  rowIndex: 0
};

describe('exporter column headers', () => {
  const batch = {
    results: [baseResult],
    successCount: 1,
    failureCount: 0,
    originalFileData: [{ Payee_Name: 'Acme LLC' }]
  };

  const expectedHeaders = [
    'Payee_Name',
    'AI_Classification',
    'AI_Confidence_%',
    'AI_Processing_Tier',
    'AI_Reasoning',
    'AI_Processing_Method',
    'Keyword_Exclusion',
    'Matched_Keywords',
    'Keyword_Confidence_%',
    'Keyword_Reasoning',
    'Matching_Rules',
    'Similarity_Scores',
    'Classification_Timestamp',
    'Processing_Row_Index',
    'Data_Alignment_Status'
  ];

  it('all exporters produce identical headers', () => {
    const merged = exportResultsWithOriginalDataV3(batch, true);
    const fixed = exportResultsFixed(batch, true);
    const fallback = createFallbackExportData(batch.results);

    expect(Object.keys(merged[0])).toEqual(expectedHeaders);
    expect(Object.keys(fixed[0])).toEqual(expectedHeaders);
    expect(Object.keys(fallback[0])).toEqual(expectedHeaders);
  });
});
