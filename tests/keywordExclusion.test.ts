import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkKeywordExclusion } from '@/lib/classification/enhancedKeywordExclusion';
import { filterPayeeNames } from '@/lib/classification/keywordExclusion';

function mockLocalStorage(keywords: string[]) {
  const storage = {
    getItem: vi.fn(() => JSON.stringify(keywords)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  } as unknown as Storage;
  Object.defineProperty(global, 'localStorage', { value: storage, configurable: true });
}

describe('checkKeywordExclusion', () => {
  afterEach(() => {
    // cleanup mocked localStorage
    // @ts-ignore
    delete (global as any).localStorage;
  });

  it('marks name as excluded when keyword present', () => {
    mockLocalStorage(['Example']);
    const result = checkKeywordExclusion('Example Company');
    expect(result.isExcluded).toBe(true);
  });

  it('does not exclude when keyword missing', () => {
    mockLocalStorage(['Test']);
    const result = checkKeywordExclusion('Example Company');
    expect(result.isExcluded).toBe(false);
  });
});

describe('filterPayeeNames', () => {
  it('deduplicates names irrespective of casing', () => {
    const result = filterPayeeNames(['Acme', 'acme']);

    expect(result.validNames).toEqual(['Acme']);
    expect(result.excludedNames).toEqual([]);
  });
});
