import { describe, it, expect, expectTypeOf } from 'vitest';
import { exportResultsWithOriginalDataV3, createFallbackExportData, ExportRow } from '@/lib/classification/exporters';
import type { BatchProcessingResult } from '@/lib/types';

// Helper to create a basic classification result
const createResult = (
  payeeName: string,
  classification: 'Business' | 'Individual',
  rowIndex: number
): any => ({
  payeeName,
  result: {
    classification,
    confidence: 90,
    reasoning: 'r',
    processingTier: 'AI-Powered'
  },
  timestamp: new Date('2024-01-01T00:00:00Z'),
  rowIndex
});

describe('exportResultsWithOriginalDataV3 payee column matching', () => {
  it('uses the specified payee column when matching results', () => {
    const batch: BatchProcessingResult = {
      results: [
        createResult('Acme LLC', 'Business', 0),
        createResult('John Doe', 'Individual', 1)
      ],
      successCount: 2,
      failureCount: 0,
      originalFileData: [
        { 'Vendor Name': 'Acme LLC', 'Contact Name': 'Someone' },
        { 'Vendor Name': 'John Doe', 'Contact Name': 'Other' }
      ]
    };

    const rows = exportResultsWithOriginalDataV3(batch, true);

    expect(rows[0]['Vendor Name']).toBe('Acme LLC');
    expect(rows[0]['AI_Classification']).toBe('Business');
    expect(rows[1]['Vendor Name']).toBe('John Doe');
    expect(rows[1]['AI_Classification']).toBe('Individual');
  });
});

describe('exported rows conform to ExportRow interface', () => {
  it('main exporter returns rows matching ExportRow', () => {
    const batch: BatchProcessingResult = {
      results: [createResult('Acme LLC', 'Business', 0)],
      successCount: 1,
      failureCount: 0,
      originalFileData: [{ 'Vendor Name': 'Acme LLC' }]
    };

    const [row] = exportResultsWithOriginalDataV3(batch, true);
    const expectedColumns = [
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
      'Classification_Timestamp',
      'Processing_Row_Index'
    ];

    expectedColumns.forEach(col => expect(row).toHaveProperty(col));
    expectTypeOf(row).toMatchTypeOf<ExportRow>();
  });

  it('fallback exporter returns rows matching ExportRow', () => {
    const results = [createResult('Acme LLC', 'Business', 0)];
    const [row] = createFallbackExportData(results);

    const expectedColumns = [
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
      'Classification_Timestamp',
      'Processing_Row_Index'
    ];

    expectedColumns.forEach(col => expect(row).toHaveProperty(col));
    expectTypeOf(row).toMatchTypeOf<ExportRow>();
  });
});
