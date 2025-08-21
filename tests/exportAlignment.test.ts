import { describe, it, expect } from 'vitest';
import { exportResultsWithOriginalDataV3 } from '@/lib/classification/batchExporter';
import type { BatchProcessingResult } from '@/lib/types';

// Helper to create a basic classification result
const createResult = (payeeName: string, classification: 'Business' | 'Individual'): any => ({
  payeeName,
  result: {
    classification,
    confidence: 90,
    reasoning: 'r',
    processingTier: 'AI-Powered'
  },
  timestamp: new Date('2024-01-01T00:00:00Z'),
  rowIndex: -1 // original index (overridden in tests)
});

describe('exportResultsWithOriginalDataV3 payee column matching', () => {
  it('uses the specified payee column when matching results', () => {
    const batch: BatchProcessingResult = {
      results: [
        { ...createResult('Acme LLC', 'Business'), rowIndex: 0 },
        { ...createResult('John Doe', 'Individual'), rowIndex: 1 }
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
