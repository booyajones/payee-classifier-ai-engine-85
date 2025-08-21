import { describe, it, expect } from 'vitest';
import { normalizeName } from '@/lib/classification/nameProcessing';

describe('normalizeName punctuation handling', () => {
  it('normalizes names with apostrophes to match those without', () => {
    const withApostrophe = normalizeName("O'Brien Corp");
    const withoutApostrophe = normalizeName('O Brien');
    expect(withApostrophe.normalized).toBe(withoutApostrophe.normalized);
    expect(withApostrophe.hash).toBe(withoutApostrophe.hash);
  });

  it('normalizes names with hyphens to match those without', () => {
    const withHyphen = normalizeName('Acme-Co');
    const withoutHyphen = normalizeName('Acme Co');
    expect(withHyphen.normalized).toBe(withoutHyphen.normalized);
    expect(withHyphen.hash).toBe(withoutHyphen.hash);
  });
});
