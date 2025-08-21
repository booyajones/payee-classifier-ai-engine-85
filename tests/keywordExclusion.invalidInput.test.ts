import { describe, it, expect } from 'vitest';
import { checkKeywordExclusion, filterPayeeNames } from '@/lib/classification/keywordExclusion';

describe('checkKeywordExclusion invalid input handling', () => {
  it('returns not excluded for invalid input', () => {
    const result = checkKeywordExclusion(undefined as any);
    expect(result.isExcluded).toBe(false);
    expect(result.matchedKeywords).toHaveLength(0);
  });
});

describe('filterPayeeNames invalid input handling', () => {
  it('skips invalid names', () => {
    const { validNames, excludedNames } = filterPayeeNames([
      'Qwerty',
      '',
      '  ',
      null as any
    ]);
    expect(validNames).toEqual(['Qwerty']);
    expect(excludedNames).toHaveLength(0);
  });
});
