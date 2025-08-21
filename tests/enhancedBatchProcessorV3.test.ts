import { describe, it, expect, vi, beforeAll } from 'vitest';
import { DEFAULT_CLASSIFICATION_CONFIG } from '@/lib/classification/config';

vi.mock('@/lib/backend', () => {
  return {
    upsertDedupeLinks: vi.fn().mockResolvedValue(undefined)
  };
});

import { enhancedProcessBatchV3 } from '@/lib/classification/enhancedBatchProcessorV3';
import { upsertDedupeLinks } from '@/lib/backend';

describe('enhancedProcessBatchV3 dedupe links', () => {
  it('saves fuzzy duplicate links', async () => {
    const names = ['Acme Systems', 'Acme System'];
    const config = {
      ...DEFAULT_CLASSIFICATION_CONFIG,
      offlineMode: true,
      similarityThreshold: 90
    };

    await enhancedProcessBatchV3(names, config);

    expect(upsertDedupeLinks).toHaveBeenCalledTimes(1);
    const links = (upsertDedupeLinks as any).mock.calls[0][0];
    expect(links).toContainEqual({
      canonical_normalized: 'ACME SYSTEMS',
      duplicate_normalized: 'ACME SYSTEM'
    });
  });
});
