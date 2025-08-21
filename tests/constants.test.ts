import { describe, it, expect } from 'vitest';
import {
  LEGAL_SUFFIXES,
  BUSINESS_KEYWORDS,
  INDUSTRY_IDENTIFIERS,
  GOVERNMENT_PATTERNS,
  PROFESSIONAL_TITLES
} from '../src/lib/classification/config.ts';

function expectSortedUnique(arr: string[]) {
  const sorted = [...arr].sort((a, b) => a.localeCompare(b));
  expect(arr).toEqual(sorted);
  expect(new Set(arr).size).toBe(arr.length);
}

describe('classification constants', () => {
  it('LEGAL_SUFFIXES sorted and unique', () => {
    expectSortedUnique(LEGAL_SUFFIXES);
  });

  it('BUSINESS_KEYWORDS sorted and unique', () => {
    expectSortedUnique(BUSINESS_KEYWORDS);
  });

  it('GOVERNMENT_PATTERNS sorted and unique', () => {
    expectSortedUnique(GOVERNMENT_PATTERNS);
  });

  it('PROFESSIONAL_TITLES sorted and unique', () => {
    expectSortedUnique(PROFESSIONAL_TITLES);
  });

  it('INDUSTRY_IDENTIFIERS categories sorted and unique', () => {
    for (const list of Object.values(INDUSTRY_IDENTIFIERS)) {
      expectSortedUnique(list);
    }
  });
});
