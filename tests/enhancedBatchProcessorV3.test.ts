import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_CLASSIFICATION_CONFIG } from '@/lib/classification/config';

vi.mock('@/lib/backend', () => {
  return {
    upsertDedupeLinks: vi.fn().mockResolvedValue(undefined)
  };
});

import { enhancedProcessBatch } from '@/lib/classification/enhancedBatchProcessor';
import { upsertDedupeLinks } from '@/lib/backend';

describe('enhancedProcessBatch dedupe links', () => {
  it('saves fuzzy duplicate links', async () => {
    const names = ['Acme Systems', 'Acme System'];
    const config = {
      ...DEFAULT_CLASSIFICATION_CONFIG,
      offlineMode: true,
      similarityThreshold: 90
    };

    await enhancedProcessBatch(names, config, { strategy: 'v3' });

    expect(upsertDedupeLinks).toHaveBeenCalledTimes(1);
    const links = (upsertDedupeLinks as any).mock.calls[0][0];
    expect(links).toContainEqual({
      canonical_normalized: 'ACME SYSTEMS',
      duplicate_normalized: 'ACME SYSTEM'
    });
  });
});

