import { useEffect } from 'react';

const STORAGE_KEYS = {
  BATCH_JOBS: 'batchJobs',
  PROCESSING_RESULTS: 'processingResults',
  USER_PREFERENCES: 'userPreferences'
};

const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for localStorage
const EMERGENCY_CLEANUP_THRESHOLD = 0.95; // Emergency cleanup when 95% full
const REGULAR_CLEANUP_THRESHOLD = 0.8; // Regular cleanup when 80% full

export const useStorageCleanup = () => {
  const getStorageSize = (): number => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  };

  const emergencyCleanup = (): boolean => {
    try {
      console.log('[STORAGE] EMERGENCY CLEANUP INITIATED');
      
      // 1. Remove all old processing results immediately
      const allKeys = Object.keys(localStorage);
      const resultKeys = allKeys.filter(key => 
        key.startsWith('processing_result_') || 
        key.startsWith('batch_result_') ||
        key.startsWith('classification_')
      );
      
      resultKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      console.log(`[STORAGE] Emergency: Removed ${resultKeys.length} result files`);
      
      // 2. Clean up batch jobs - keep only the 5 most recent and remove originalFileData
      const batchJobsData = localStorage.getItem(STORAGE_KEYS.BATCH_JOBS);
      if (batchJobsData) {
        try {
          const jobs = JSON.parse(batchJobsData);
          if (Array.isArray(jobs)) {
            // Sort by creation date and keep only 5 most recent
            const sortedJobs = jobs.sort((a, b) => b.created_at - a.created_at).slice(0, 5);
            
            // Remove originalFileData from all jobs to save space
            const lightweightJobs = sortedJobs.map(job => ({
              ...job,
              originalFileData: [] // Clear this to save massive amounts of space
            }));
            
            localStorage.setItem(STORAGE_KEYS.BATCH_JOBS, JSON.stringify(lightweightJobs));
            console.log(`[STORAGE] Emergency: Trimmed batch jobs to ${lightweightJobs.length}, removed originalFileData`);
          }
        } catch (error) {
          console.error('[STORAGE] Emergency: Error cleaning batch jobs:', error);
          localStorage.removeItem(STORAGE_KEYS.BATCH_JOBS);
        }
      }
      
      // 3. Remove any other large items
      const remainingKeys = Object.keys(localStorage);
      remainingKeys.forEach(key => {
        if (!Object.values(STORAGE_KEYS).includes(key)) {
          try {
            const item = localStorage.getItem(key);
            if (item && item.length > 50000) { // Remove items larger than 50KB
              localStorage.removeItem(key);
              console.log(`[STORAGE] Emergency: Removed large item ${key}`);
            }
          } catch (error) {
            // Remove corrupted items
            localStorage.removeItem(key);
          }
        }
      });
      
      const finalSize = getStorageSize();
      console.log(`[STORAGE] Emergency cleanup complete: ${(finalSize / 1024).toFixed(2)}KB remaining`);
      return true;
    } catch (error) {
      console.error('[STORAGE] Emergency cleanup failed:', error);
      return false;
    }
  };

  const cleanupOldData = () => {
    try {
      const currentSize = getStorageSize();
      const usagePercent = currentSize / MAX_STORAGE_SIZE;
      
      console.log(`[STORAGE] Current localStorage: ${(currentSize / 1024).toFixed(2)}KB (${(usagePercent * 100).toFixed(1)}%)`);
      
      // Emergency cleanup if near quota
      if (usagePercent > EMERGENCY_CLEANUP_THRESHOLD) {
        console.log('[STORAGE] EMERGENCY CLEANUP TRIGGERED');
        return emergencyCleanup();
      }
      
      // Regular cleanup
      if (usagePercent > REGULAR_CLEANUP_THRESHOLD) {
        console.log('[STORAGE] Regular cleanup triggered');
        
        // Clean up old batch jobs (keep only last 10)
        const batchJobsKey = STORAGE_KEYS.BATCH_JOBS;
        const batchJobsData = localStorage.getItem(batchJobsKey);
        
        if (batchJobsData) {
          try {
            const jobs = JSON.parse(batchJobsData);
            if (Array.isArray(jobs) && jobs.length > 10) {
              const sortedJobs = jobs.sort((a, b) => b.created_at - a.created_at);
              const trimmedJobs = sortedJobs.slice(0, 10);
              localStorage.setItem(batchJobsKey, JSON.stringify(trimmedJobs));
              console.log(`[STORAGE] Trimmed batch jobs: ${jobs.length} -> ${trimmedJobs.length}`);
            }
          } catch (error) {
            console.error('[STORAGE] Error cleaning up batch jobs:', error);
          }
        }
        
        // Remove old processing results
        const allKeys = Object.keys(localStorage);
        const timestampedKeys = allKeys.filter(key => 
          key.startsWith('processing_result_') || 
          key.startsWith('batch_result_')
        ).sort();
        
        const keysToRemove = timestampedKeys.slice(0, Math.ceil(timestampedKeys.length / 3));
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        if (keysToRemove.length > 0) {
          console.log(`[STORAGE] Removed ${keysToRemove.length} old results`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('[STORAGE] Cleanup failed:', error);
      return emergencyCleanup();
    }
  };

  const safeSetItem = (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`[STORAGE] Failed to set ${key}:`, error);
      
      // Try emergency cleanup and retry
      const cleanupSuccess = emergencyCleanup();
      if (cleanupSuccess) {
        try {
          localStorage.setItem(key, value);
          console.log(`[STORAGE] Successfully saved ${key} after emergency cleanup`);
          return true;
        } catch (retryError) {
          console.error(`[STORAGE] Still failed to set ${key} after emergency cleanup:`, retryError);
        }
      }
      
      return false;
    }
  };

  const clearAllStorage = (): void => {
    try {
      const essentialKeys = [STORAGE_KEYS.USER_PREFERENCES];
      const backup: Record<string, string> = {};
      
      // Backup essential data
      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) backup[key] = value;
      });
      
      // Clear everything
      localStorage.clear();
      
      // Restore essential data
      Object.entries(backup).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      console.log('[STORAGE] Manual storage reset completed');
    } catch (error) {
      console.error('[STORAGE] Manual reset failed:', error);
    }
  };

  useEffect(() => {
    // Run cleanup on mount
    cleanupOldData();
    
    // Set up periodic cleanup every 2 minutes (more frequent)
    const interval = setInterval(cleanupOldData, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    cleanupOldData,
    emergencyCleanup,
    safeSetItem,
    clearAllStorage,
    getStorageSize
  };
};
