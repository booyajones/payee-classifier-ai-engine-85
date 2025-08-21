import { describe, it, expect, vi, afterEach } from 'vitest';
import { createPayeeClassification } from '@/lib/utils';

// simple mock classification result
const baseResult = {
  classification: 'Business' as const,
  confidence: 90,
  reasoning: 'r',
  processingTier: 'AI-Powered' as const,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPayeeClassification', () => {
  it('uses crypto.randomUUID for id generation', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-2222-3333-4444-555555555555');
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const classification = createPayeeClassification('Acme LLC', baseResult);
    expect(classification.id).toBe('payee-1700000000000-11111111-2222-3333-4444-555555555555');
  });
});
