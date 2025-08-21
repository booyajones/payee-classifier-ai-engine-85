import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/backend', () => {
  const upsertUploadBatch = vi.fn().mockResolvedValue('batch123');
  const upsertUploadRows = vi.fn().mockImplementation(async (rows: any[]) =>
    rows.map((r, idx) => ({ ...r, id: idx + 1 }))
  );
  const upsertClassifications = vi.fn().mockResolvedValue(undefined);
  const upsertDedupeLinks = vi.fn().mockResolvedValue(undefined);
  const fetchDedupeMap = vi.fn().mockResolvedValue(new Map());
  return {
    isSupabaseConfigured: () => true,
    upsertUploadBatch,
    upsertUploadRows,
    upsertClassifications,
    upsertDedupeLinks,
    fetchDedupeMap,
    supabase: {},
  };
});

import { saveProcessingResults } from '@/lib/storage/resultStorage';
import type { PayeeClassification, BatchProcessingResult } from '@/lib/types';
import { upsertUploadRows, upsertClassifications, upsertDedupeLinks } from '@/lib/backend';

describe('saveProcessingResults', () => {
  it('deduplicates payees and persists dedupe links', async () => {
    const results: PayeeClassification[] = [
      {
        id: '1',
        payeeName: 'Acme Electric',
        result: {
          classification: 'Business',
          confidence: 1,
          reasoning: '',
          processingTier: 'AI-Powered',
        },
        timestamp: new Date(),
        rowIndex: 0,
      },
      {
        id: '2',
        payeeName: 'Acme Electrical',
        result: {
          classification: 'Business',
          confidence: 1,
          reasoning: '',
          processingTier: 'AI-Powered',
        },
        timestamp: new Date(),
        rowIndex: 1,
      },
    ];

    const summary: BatchProcessingResult = {
      results,
      successCount: 2,
      failureCount: 0,
      processingTime: 100,
      originalFileData: [],
      enhancedStats: undefined,
    };

    const batchId = await saveProcessingResults(results, summary);
    expect(batchId).toBe('batch123');

    // Only one canonical row should be inserted
    expect(upsertUploadRows).toHaveBeenCalledTimes(1);
    const savedRows = (upsertUploadRows as any).mock.calls[0][0] as any[];
    expect(savedRows).toHaveLength(1);
    expect(savedRows[0]).toMatchObject({
      payee_name: 'Acme Electric',
      normalized_name: 'ACME ELECTRIC',
    });

    // Classifications correspond to deduplicated rows
    expect(upsertClassifications).toHaveBeenCalledTimes(1);
    const savedClassifications = (upsertClassifications as any).mock.calls[0][0] as any[];
    expect(savedClassifications).toHaveLength(1);

    // Dedupe links should be persisted for duplicates
    expect(upsertDedupeLinks).toHaveBeenCalled();
    const linkCalls = (upsertDedupeLinks as any).mock.calls.flatMap((c: any[]) => c[0]);
    expect(linkCalls).toContainEqual({
      canonical_normalized: 'ACME ELECTRIC',
      duplicate_normalized: 'ACME ELECTRICAL',
    });
  });
});

