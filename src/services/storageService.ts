
import { logger } from '@/lib/logger';

export interface StorageService {
  setItem: (key: string, value: string) => boolean;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  clear: () => void;
  getSize: () => number;
  cleanup: () => boolean;
  isUsingFallback: boolean;
  storageStatus: 'localStorage' | 'memory' | 'error';
}

class UnifiedStorageService implements StorageService {
  private memoryStorage: Record<string, string> = {};
  private _isUsingFallback = false;
  private _storageStatus: 'localStorage' | 'memory' | 'error' = 'localStorage';
  
  private readonly MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB
  private readonly EMERGENCY_THRESHOLD = 0.95;
  private readonly REGULAR_THRESHOLD = 0.8;

  get isUsingFallback(): boolean {
    return this._isUsingFallback;
  }

  get storageStatus(): 'localStorage' | 'memory' | 'error' {
    return this._storageStatus;
  }

  getSize(): number {
    let total = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
    } catch (error) {
      logger.error('[STORAGE] Error calculating size:', error);
    }
    return total;
  }

  setItem(key: string, value: string): boolean {
    // Try localStorage first
    try {
      const success = this.safeSetItem(key, value);
      if (success) {
        this._storageStatus = 'localStorage';
        this._isUsingFallback = false;
        return true;
      }
    } catch (error) {
      logger.warn(`[STORAGE] localStorage failed for ${key}:`, error);
    }

    // Fallback to memory storage
    logger.log(`[STORAGE] Using memory storage for ${key}`);
    this.memoryStorage[key] = value;
    this._isUsingFallback = true;
    this._storageStatus = 'memory';
    return true;
  }

  getItem(key: string): string | null {
    // Check localStorage first
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch (error) {
      logger.warn(`[STORAGE] localStorage read failed for ${key}:`, error);
    }

    // Check memory storage
    return this.memoryStorage[key] || null;
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.warn(`[STORAGE] localStorage remove failed for ${key}:`, error);
    }
    delete this.memoryStorage[key];
  }

  clear(): void {
    try {
      const essentialKeys = ['userPreferences'];
      const backup: Record<string, string> = {};
      
      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) backup[key] = value;
      });
      
      localStorage.clear();
      
      Object.entries(backup).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      logger.info('[STORAGE] Manual storage reset completed');
    } catch (error) {
      logger.error('[STORAGE] Manual reset failed:', error);
    }
    
    this.memoryStorage = {};
  }

  cleanup(): boolean {
    try {
      const currentSize = this.getSize();
      const usagePercent = currentSize / this.MAX_STORAGE_SIZE;
      
      if (usagePercent > this.EMERGENCY_THRESHOLD) {
        return this.emergencyCleanup();
      }
      
      if (usagePercent > this.REGULAR_THRESHOLD) {
        return this.regularCleanup();
      }
      
      return true;
    } catch (error) {
      logger.error('[STORAGE] Cleanup failed:', error);
      return this.emergencyCleanup();
    }
  }

  private safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      logger.error(`[STORAGE] Failed to set ${key}:`, error);
      
      const cleanupSuccess = this.emergencyCleanup();
      if (cleanupSuccess) {
        try {
          localStorage.setItem(key, value);
          logger.log(`[STORAGE] Successfully saved ${key} after cleanup`);
          return true;
        } catch (retryError) {
          logger.error(`[STORAGE] Still failed after cleanup:`, retryError);
        }
      }
      
      return false;
    }
  }

  private emergencyCleanup(): boolean {
    try {
      logger.log('[STORAGE] EMERGENCY CLEANUP INITIATED');
      
      // Remove processing results
      const allKeys = Object.keys(localStorage);
      const resultKeys = allKeys.filter(key => 
        key.startsWith('processing_result_') || 
        key.startsWith('batch_result_') ||
        key.startsWith('classification_')
      );
      
      resultKeys.forEach(key => localStorage.removeItem(key));
      
      // Clean batch jobs
      const batchJobsData = localStorage.getItem('batchJobs');
      if (batchJobsData) {
        try {
          const jobs = JSON.parse(batchJobsData);
          if (Array.isArray(jobs)) {
            const sortedJobs = jobs.sort((a, b) => b.created_at - a.created_at).slice(0, 5);
            const lightweightJobs = sortedJobs.map(job => ({
              ...job,
              originalFileData: []
            }));
            localStorage.setItem('batchJobs', JSON.stringify(lightweightJobs));
          }
        } catch (error) {
          localStorage.removeItem('batchJobs');
        }
      }
      
      logger.log('[STORAGE] Emergency cleanup complete');
      return true;
    } catch (error) {
      logger.error('[STORAGE] Emergency cleanup failed:', error);
      return false;
    }
  }

  private regularCleanup(): boolean {
    try {
      logger.log('[STORAGE] Regular cleanup triggered');
      
      // Clean old processing results
      const allKeys = Object.keys(localStorage);
      const timestampedKeys = allKeys.filter(key => 
        key.startsWith('processing_result_') || 
        key.startsWith('batch_result_')
      ).sort();
      
      const keysToRemove = timestampedKeys.slice(0, Math.ceil(timestampedKeys.length / 3));
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      return true;
    } catch (error) {
      logger.error('[STORAGE] Regular cleanup failed:', error);
      return false;
    }
  }
}

export const storageService = new UnifiedStorageService();
