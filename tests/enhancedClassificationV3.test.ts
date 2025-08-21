import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Mock OpenAI helpers to prevent actual API calls
vi.mock('@/lib/openai/enhancedClassification', () => ({
  consensusClassification: vi.fn()
}));

// Simple localStorage mock
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => (key in storage ? storage[key] : null),
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
vi.stubGlobal('localStorage', localStorageMock as any);

let enhancedClassifyPayeeV3: typeof import('@/lib/classification/enhancedClassificationV3')['enhancedClassifyPayeeV3'];

beforeAll(async () => {
  ({ enhancedClassifyPayeeV3 } = await import('@/lib/classification/enhancedClassificationV3'));
});

beforeEach(() => {
  localStorage.clear();
});

describe('enhancedClassifyPayeeV3', () => {
  it('matches cached names regardless of case', async () => {
    // Seed cache with uppercase name
    localStorage.setItem('payeeClassifications', JSON.stringify({
      ALPHABETA: { result: { classification: 'Business' }, timestamp: Date.now() }
    }));

    const result = await enhancedClassifyPayeeV3('alphabeta', { offlineMode: true } as any);

    expect(result.classification).toBe('Business');
    expect(result.reasoning).toContain('fuzzy match');
    expect(result.reasoning).toContain('alphabeta');
    expect(result.reasoning).toContain('ALPHABETA');
  });
});
