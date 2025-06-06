import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for the OpenAI client methods
const fileCreate = vi.fn();
const fileContent = vi.fn();
const batchCreate = vi.fn();

vi.mock('@/lib/openai/client', () => ({
  getOpenAIClient: () => ({
    files: { create: fileCreate, content: fileContent },
    batches: { create: batchCreate, retrieve: vi.fn(), cancel: vi.fn() }
  })
}));

vi.mock('@/lib/openai/apiUtils', () => ({
  makeAPIRequest: async (fn: any) => fn(),
  logMemoryUsage: vi.fn()
}));

import { createBatchJob, getBatchJobResults } from '@/lib/openai/trueBatchAPI';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createBatchJob', () => {
  it('creates a batch job via OpenAI client', async () => {
    fileCreate.mockResolvedValue({ id: 'file1' });
    batchCreate.mockResolvedValue({
      id: 'batch1',
      status: 'in_progress',
      created_at: 100,
      request_counts: { total: 2, completed: 0, failed: 0 },
      metadata: { payee_count: '2', description: 'desc' }
    });

    const job = await createBatchJob(['A', 'B'], 'desc');

    expect(fileCreate).toHaveBeenCalled();
    expect(batchCreate).toHaveBeenCalledWith({
      input_file_id: 'file1',
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: { payee_count: '2', description: 'desc' }
    });
    expect(job.id).toBe('batch1');
    expect(job.metadata?.payee_count).toBe(2);
  });
});

describe('getBatchJobResults', () => {
  it('parses JSONL results for completed jobs', async () => {
    const jsonl = [
      JSON.stringify({
        custom_id: 'payee-0-1',
        response: { status_code: 200, body: { choices: [{ message: { content: '{"classification":"Business","confidence":90,"reasoning":"r"}' } }] } }
      }),
      JSON.stringify({
        custom_id: 'payee-1-1',
        response: { status_code: 200, body: { choices: [{ message: { content: '{"classification":"Individual","confidence":80,"reasoning":"r"}' } }] } }
      })
    ].join('\n');

    fileContent.mockResolvedValue({ text: async () => jsonl });

    const job = {
      id: 'batch1',
      status: 'completed',
      output_file_id: 'file1',
      request_counts: { total: 2, completed: 2, failed: 0 }
    } as any;

    const results = await getBatchJobResults(job, ['A', 'B']);

    expect(fileContent).toHaveBeenCalledWith('file1');
    expect(results[0].classification).toBe('Business');
    expect(results[1].classification).toBe('Individual');
  });

  it('throws when job has no results yet', async () => {
    const job = { id: 'x', status: 'in_progress' } as any;
    await expect(getBatchJobResults(job, ['A'])).rejects.toThrow('Batch job is not completed');
  });
});
