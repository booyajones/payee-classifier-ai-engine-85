import { describe, it, expect } from 'vitest';
import { enhancedProcessBatch } from '@/lib/classification/enhancedBatchProcessor';

describe('enhancedProcessBatch', () => {
  it('marks excluded names as business entities', async () => {
    const names = ['Bank of Test'];
    const result = await enhancedProcessBatch(names);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].result.classification).toBe('Business');
    expect(result.results[0].result.processingTier).toBe('Excluded');
  });
});

