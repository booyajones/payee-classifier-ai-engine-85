import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies used inside the hybrid processor
vi.mock('@/lib/openai/optimizedBatchClassification', () => ({
  optimizedBatchClassification: vi.fn()
}));
vi.mock('@/lib/openai/trueBatchAPI', () => ({
  createBatchJob: vi.fn(),
  getBatchJobResults: vi.fn()
}));

import { processWithHybridBatch, completeBatchJob } from '@/lib/openai/hybridBatchProcessor';
import { createBatchJob, getBatchJobResults } from '@/lib/openai/trueBatchAPI';
import { optimizedBatchClassification } from '@/lib/openai/optimizedBatchClassification';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processWithHybridBatch', () => {
  it('merges realtime AI results and reports progress', async () => {
    optimizedBatchClassification.mockResolvedValue([
      { payeeName: 'Acme LLC', classification: 'Business', confidence: 98, reasoning: 'mock' },
      { payeeName: 'John Doe', classification: 'Individual', confidence: 90, reasoning: 'mock' }
    ]);

    const progress = vi.fn();
    const result = await processWithHybridBatch(['Acme LLC', 'John Doe'], 'realtime', progress);

    expect(progress).toHaveBeenCalled();
    const last = progress.mock.calls.at(-1);
    expect(last[0]).toBe(2); // current
    expect(last[1]).toBe(2); // total
    expect(last[2]).toBe(100); // percentage
    expect(result.results[0].classification).toBe('Business');
    expect(result.results[1].classification).toBe('Individual');
  });

  it('submits batch jobs and returns job info', async () => {
    createBatchJob.mockResolvedValue({
      id: 'job1',
      status: 'in_progress',
      created_at: 1,
      request_counts: { total: 2, completed: 0, failed: 0 }
    });

    const progress = vi.fn();
    const result = await processWithHybridBatch(['Acme LLC', 'John Doe'], 'batch', progress);

    expect(createBatchJob).toHaveBeenCalledWith(['Acme LLC', 'John Doe'], expect.any(String));
    expect(result.batchJob?.id).toBe('job1');
    const last = progress.mock.calls.at(-1);
    expect(last[2]).toBe(100); // final percentage
  });

  it('throws a descriptive error when batch creation fails', async () => {
    createBatchJob.mockRejectedValue(new Error('boom'));
    await expect(processWithHybridBatch(['Acme LLC'], 'batch')).rejects.toThrow('Failed to create batch job: boom');
  });

  it('handles invalid names without sending them to AI', async () => {
    optimizedBatchClassification.mockResolvedValue([
      { payeeName: 'Acme LLC', classification: 'Business', confidence: 98, reasoning: 'mock' }
    ]);

    const result = await processWithHybridBatch(['Acme LLC', '' as any], 'realtime');

    expect(optimizedBatchClassification).toHaveBeenCalledWith(['Acme LLC'], 30000);
    expect(result.results[1].processingTier).toBe('Failed');
    expect(result.results[1].reasoning).toContain('Invalid payee name');
  });
});

describe('completeBatchJob', () => {
  it('merges stored batch results with keyword exclusions', async () => {
    const job = { id: 'j1', status: 'completed', output_file_id: 'f', request_counts: { total: 1, completed: 1, failed: 0 } } as any;
    getBatchJobResults.mockResolvedValue([
      { payeeName: 'John Doe', classification: 'Individual', confidence: 88, reasoning: 'mock', status: 'success' }
    ]);

    const result = await completeBatchJob(job, ['Bank of America', 'John Doe']);

    expect(getBatchJobResults).toHaveBeenCalledWith(job, ['John Doe']);
    expect(result.results[0].processingTier).toBe('Rule-Based'); // excluded
    expect(result.results[1].classification).toBe('Individual');
    expect(result.stats?.aiProcessed).toBe(1);
  });
});
