import { describe, it, expect } from 'vitest';
import { applyAIClassification } from '../src/lib/classification/aiClassification.ts';

describe('applyAIClassification input validation', () => {
  it('returns Unknown for empty string', async () => {
    const result = await applyAIClassification('');
    expect(result.classification).toBe('Unknown');
    expect(result.confidence).toBeLessThan(50);
    expect(result.reasoning).toMatch(/invalid/i);
  });

  it('returns Unknown for non-string input', async () => {
    const result = await applyAIClassification(undefined as unknown as string);
    expect(result.classification).toBe('Unknown');
    expect(result.confidence).toBeLessThan(50);
    expect(result.reasoning).toMatch(/invalid/i);
  });
});
