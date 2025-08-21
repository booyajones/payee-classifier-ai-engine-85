import { describe, it, expect } from 'vitest';
import { enhancedProcessBatch } from '@/lib/classification/enhancedBatchProcessor';

describe('enhancedProcessBatch', () => {
  it('marks excluded names as business entities', async () => {
    const names = ['Bank of Test'];
    const results = await enhancedProcessBatch(names);

    expect(results).toHaveLength(1);
    expect(results[0].classification).toBe('Business');
    expect(results[0].processingTier).toBe('Excluded');
  });
});

