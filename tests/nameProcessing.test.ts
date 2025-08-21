import { describe, it, expect } from 'vitest';
import { normalizePayeeName } from '@/lib/classification/nameProcessing';

describe('normalizePayeeName punctuation handling', () => {
  it('normalizes names with apostrophes to match those without', () => {
    const withApostrophe = normalizePayeeName("O'Brien Corp");
    const withoutApostrophe = normalizePayeeName('O Brien');
    expect(withApostrophe).toBe(withoutApostrophe);
  });

  it('normalizes names with hyphens to match those without', () => {
    const withHyphen = normalizePayeeName('Acme-Co');
    const withoutHyphen = normalizePayeeName('Acme Co');
    expect(withHyphen).toBe(withoutHyphen);
  });
});
