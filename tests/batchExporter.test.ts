import { describe, it, expect } from 'vitest';
import { findResultByName } from '@/lib/classification/batchExporter';

describe('findResultByName', () => {
  const results = [
    { payeeName: 'Acme', rowIndex: 0 },
    { payeeName: 'Acme', rowIndex: 1 }
  ];

  it('returns the match with the preferred index when available', () => {
    const match = findResultByName('Acme', results, 1);
    expect(match?.rowIndex).toBe(1);
  });

  it('falls back to the first match when preferred index is missing', () => {
    const match = findResultByName('Acme', results, 5);
    expect(match?.rowIndex).toBe(0);
  });

  it('matches names ignoring punctuation and spacing differences', () => {
    const punctuationResults = [
      { payeeName: 'Pepsi Cola', rowIndex: 0 }
    ];
    const match = findResultByName('Pepsi. Cola', punctuationResults);
    expect(match?.rowIndex).toBe(0);
  });

  it('finds near matches using similarity threshold', () => {
    const fuzzyResults = [
      { payeeName: 'Starbucks Coffee', rowIndex: 0 }
    ];
    const match = findResultByName('Starbucks Cofee', fuzzyResults);
    expect(match?.rowIndex).toBe(0);
  });

  it('respects the similarity threshold when no close match exists', () => {
    const fuzzyResults = [
      { payeeName: 'Starbucks Coffee', rowIndex: 0 }
    ];
    const match = findResultByName('Starbucks Cofee', fuzzyResults, undefined, 99);
    expect(match).toBeNull();
  });
});
