
import { useState, useRef } from 'react';
import { useStorageCleanup } from './useStorageCleanup';
import { logger } from '@/lib/logger';

interface FallbackStorageHook {
  setItem: (key: string, value: string) => boolean;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  isUsingFallback: boolean;
  storageStatus: 'localStorage' | 'memory' | 'error';
}

export const useFallbackStorage = (): FallbackStorageHook => {
  const { safeSetItem, emergencyCleanup } = useStorageCleanup();
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'localStorage' | 'memory' | 'error'>('localStorage');
  const memoryStorage = useRef<Record<string, string>>({});

  const setItem = (key: string, value: string): boolean => {
    // Try localStorage first
    try {
      const success = safeSetItem(key, value);
      if (success) {
        setStorageStatus('localStorage');
        setIsUsingFallback(false);
        return true;
      }
    } catch (error) {
      logger.warn(`[FALLBACK STORAGE] localStorage failed for ${key}:`, error);
    }

    // Fallback to memory storage
    logger.info(`[FALLBACK STORAGE] Using memory storage for ${key}`);
    memoryStorage.current[key] = value;
    setIsUsingFallback(true);
    setStorageStatus('memory');
    return true;
  };

  const getItem = (key: string): string | null => {
    // Check localStorage first
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch (error) {
      logger.warn(`[FALLBACK STORAGE] localStorage read failed for ${key}:`, error);
    }

    // Check memory storage
    return memoryStorage.current[key] || null;
  };

  const removeItem = (key: string): void => {
    // Remove from both storages
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.warn(`[FALLBACK STORAGE] localStorage remove failed for ${key}:`, error);
    }

    delete memoryStorage.current[key];
  };

  return {
    setItem,
    getItem,
    removeItem,
    isUsingFallback,
    storageStatus
  };
};
