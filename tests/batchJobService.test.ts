import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BatchJob } from '@/lib/openai/trueBatchAPI';

const STORAGE_KEY = 'lovable_batch_jobs';

function createBatch(id: string): BatchJob {
  return {
    id,
    object: 'batch',
    endpoint: '/v1',
    errors: null,
    input_file_id: 'file',
    completion_window: '24h',
    status: 'in_progress',
    output_file_id: null,
    error_file_id: null,
    created_at: 0,
    expires_at: 0,
    request_counts: { total: 0, completed: 0, failed: 0 },
  };
}

function createStorageMock(shouldThrow = false) {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (shouldThrow) throw new Error('fail');
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe('BatchJobService storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // ensure no leftovers between tests
    // @ts-ignore
    delete globalThis.localStorage;
    // @ts-ignore
    delete globalThis.sessionStorage;
  });

  it('persists and orders jobs using localStorage', async () => {
    const localMock = createStorageMock();
    const sessionMock = createStorageMock();
    // @ts-ignore
    globalThis.localStorage = localMock;
    // @ts-ignore
    globalThis.sessionStorage = sessionMock;

    const { batchJobService } = await import('@/services/batchJobService');

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);
    const job1 = createBatch('batch_000000001');
    await batchJobService.addJob(job1, ['p1'], []);

    nowSpy.mockReturnValue(2000);
    const job2 = createBatch('batch_000000002');
    await batchJobService.addJob(job2, ['p2'], []);

    nowSpy.mockRestore();

    let loaded = await batchJobService.loadJobs();
    expect(loaded.map(j => j.id)).toEqual(['batch_000000002', 'batch_000000001']);

    await batchJobService.updateJob({ ...job1, status: 'completed' });
    loaded = await batchJobService.loadJobs();
    expect(loaded.find(j => j.id === 'batch_000000001')?.status).toBe('completed');

    await batchJobService.deleteJob('batch_000000002');
    loaded = await batchJobService.loadJobs();
    expect(loaded.map(j => j.id)).toEqual(['batch_000000001']);

    const stored = JSON.parse(localMock.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('batch_000000001');
  });

  it('falls back to sessionStorage when localStorage is unavailable', async () => {
    const localMock = createStorageMock(true); // throws on setItem
    const sessionMock = createStorageMock();
    // @ts-ignore
    globalThis.localStorage = localMock;
    // @ts-ignore
    globalThis.sessionStorage = sessionMock;

    const { batchJobService } = await import('@/services/batchJobService');
    expect(batchJobService.getStorageInfo().storageStatus).toBe('sessionStorage');

    const job = createBatch('batch_session01');
    await batchJobService.addJob(job, [], []);

    const stored = JSON.parse(sessionMock.getItem(STORAGE_KEY)!);
    expect(stored[0].id).toBe('batch_session01');
  });

  it('falls back to memory when storage writes fail', async () => {
    const localMock = createStorageMock();
    const sessionMock = createStorageMock();
    // @ts-ignore
    globalThis.localStorage = localMock;
    // @ts-ignore
    globalThis.sessionStorage = sessionMock;

    const { batchJobService } = await import('@/services/batchJobService');

    // simulate write failures after initialization
    localMock.setItem.mockImplementation(() => {
      throw new Error('fail');
    });

    const job = createBatch('batch_memory001');
    await batchJobService.addJob(job, [], []);

    // data should not be in storage
    expect(localMock.getItem(STORAGE_KEY)).toBeNull();

    let loaded = await batchJobService.loadJobs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('batch_memory001');

    await batchJobService.updateJob({ ...job, status: 'completed' });
    loaded = await batchJobService.loadJobs();
    expect(loaded[0].status).toBe('completed');

    await batchJobService.deleteJob(job.id);
    loaded = await batchJobService.loadJobs();
    expect(loaded).toHaveLength(0);
  });
});

