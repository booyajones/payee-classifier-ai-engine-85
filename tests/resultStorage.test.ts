import { describe, it, expect, vi } from 'vitest';
import { promptVersion } from '@/lib/classification/config';

vi.mock('@/lib/backend', () => {
  const upsertUploadBatch = vi.fn().mockResolvedValue('batch123');
  const upsertUploadRows = vi
    .fn()
    .mockImplementation(async (rows: Record<string, unknown>[]) =>
      rows.map((r, idx) => ({ ...r, id: idx + 1 }))
    );
  const upsertClassifications = vi
    .fn<[Record<string, unknown>[]], Promise<void>>()
    .mockResolvedValue(undefined);
  return {
    isSupabaseConfigured: () => true,
    upsertUploadBatch,
    upsertUploadRows,
    upsertClassifications,
    supabase: {},
  };
});

import { saveProcessingResults } from '@/lib/storage/resultStorage';
import type { PayeeClassification, BatchProcessingResult } from '@/lib/types';
import { upsertUploadRows, upsertClassifications } from '@/lib/backend';

describe('saveProcessingResults', () => {
  it('persists payee_name and normalized_name', async () => {
    const results: PayeeClassification[] = [
      {
        id: '1',
        payeeName: 'Acme LLC',
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
        payeeName: 'Acme',
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

    // upload rows should be sent in a single batch
    expect(upsertUploadRows).toHaveBeenCalledTimes(1);
    const savedRows = upsertUploadRows.mock.calls[0][0] as Record<string, unknown>[];

    expect(savedRows[0]).toMatchObject({
      payee_name: 'Acme LLC',
      normalized_name: 'ACME',
    });
    expect(savedRows[1]).toMatchObject({
      payee_name: 'Acme',
      normalized_name: 'ACME',
    });
    expect(savedRows[0].normalized_name).toBe(savedRows[1].normalized_name);

    // classifications should also be buffered and saved once
    expect(upsertClassifications).toHaveBeenCalledTimes(1);
    const savedClassifications = upsertClassifications.mock
      .calls[0][0] as Record<string, unknown>[];
    expect(savedClassifications).toHaveLength(2);
    expect(savedClassifications[0]).toMatchObject({ prompt_version: promptVersion });
  });
});

