import { describe, it, expect, vi } from 'vitest';
import { storageService } from '@/services/storageService';

function createLocalStorageMock() {
  const store: Record<string, string> = {};
  const localStorageMock: any = {
    getItem(key: string) {
      return key in store ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
      Object.defineProperty(localStorageMock, key, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    },
    removeItem(key: string) {
      delete store[key];
      delete localStorageMock[key];
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key];
        delete localStorageMock[key];
      }
    },
  };
  Object.defineProperties(localStorageMock, {
    getItem: { enumerable: false },
    setItem: { enumerable: false },
    removeItem: { enumerable: false },
    clear: { enumerable: false },
  });
  return localStorageMock as Storage;
}

describe('storageService.getSize', () => {
  it('calculates size based on localStorage entries', () => {
    const mock = createLocalStorageMock();
    vi.stubGlobal('localStorage', mock);

    (storageService as any).memoryStorage = {};
    (storageService as any)._isUsingFallback = false;

    mock.setItem('foo', 'bar');
    mock.setItem('baz', 'qux');

    const expected = 'foo'.length + 'bar'.length + 'baz'.length + 'qux'.length;
    expect(storageService.getSize()).toBe(expected);
  });

  it('sums memory storage when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    (storageService as any).memoryStorage = { foo: 'bar', baz: 'qux' };
    (storageService as any)._isUsingFallback = true;

    const expected = 'foo'.length + 'bar'.length + 'baz'.length + 'qux'.length;
    expect(storageService.getSize()).toBe(expected);
  });
});

