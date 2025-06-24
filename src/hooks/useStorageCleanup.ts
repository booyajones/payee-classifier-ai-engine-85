import { useEffect } from 'react';

const STORAGE_KEYS = {
  BATCH_JOBS: 'batchJobs',
  PROCESSING_RESULTS: 'processingResults',
  USER_PREFERENCES: 'userPreferences'
};

const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB limit for localStorage
const CLEANUP_THRESHOLD = 0.8; // Clean up when 80% full

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

  const cleanupOldData = () => {
    try {
      const currentSize = getStorageSize();
      console.log(`[STORAGE] Current localStorage size: ${(currentSize / 1024).toFixed(2)}KB`);
      
      if (currentSize > MAX_STORAGE_SIZE * CLEANUP_THRESHOLD) {
        console.log('[STORAGE] Storage cleanup triggered');
        
        // Clean up old batch jobs (keep only last 20)
        const batchJobsKey = STORAGE_KEYS.BATCH_JOBS;
        const batchJobsData = localStorage.getItem(batchJobsKey);
        
        if (batchJobsData) {
          try {
            const jobs = JSON.parse(batchJobsData);
            if (Array.isArray(jobs) && jobs.length > 20) {
              // Sort by creation date and keep only the 20 most recent
              const sortedJobs = jobs.sort((a, b) => b.created_at - a.created_at);
              const trimmedJobs = sortedJobs.slice(0, 20);
              localStorage.setItem(batchJobsKey, JSON.stringify(trimmedJobs));
              console.log(`[STORAGE] Cleaned up batch jobs: ${jobs.length} -> ${trimmedJobs.length}`);
            }
          } catch (error) {
            console.error('[STORAGE] Error cleaning up batch jobs:', error);
          }
        }
        
        // If still too large, remove oldest processing results
        const newSize = getStorageSize();
        if (newSize > MAX_STORAGE_SIZE * CLEANUP_THRESHOLD) {
          console.log('[STORAGE] Additional cleanup needed, removing old processing results');
          
          // Remove items starting with oldest timestamps
          const allKeys = Object.keys(localStorage);
          const timestampedKeys = allKeys.filter(key => 
            key.startsWith('processing_result_') || 
            key.startsWith('batch_result_')
          ).sort();
          
          // Remove oldest 50% of timestamped results
          const keysToRemove = timestampedKeys.slice(0, Math.ceil(timestampedKeys.length / 2));
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
          });
          
          if (keysToRemove.length > 0) {
            console.log(`[STORAGE] Removed ${keysToRemove.length} old processing results`);
          }
        }
        
        const finalSize = getStorageSize();
        console.log(`[STORAGE] Cleanup complete: ${(finalSize / 1024).toFixed(2)}KB`);
      }
    } catch (error) {
      console.error('[STORAGE] Error during cleanup:', error);
      // If cleanup fails, try emergency cleanup
      try {
        const keys = Object.keys(localStorage);
        const oldKeys = keys.filter(key => 
          key.startsWith('processing_result_') || 
          key.startsWith('batch_result_')
        );
        oldKeys.forEach(key => localStorage.removeItem(key));
        console.log(`[STORAGE] Emergency cleanup: removed ${oldKeys.length} items`);
      } catch (emergencyError) {
        console.error('[STORAGE] Emergency cleanup failed:', emergencyError);
      }
    }
  };

  const safeSetItem = (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`[STORAGE] Failed to set ${key}:`, error);
      // Try cleanup and retry once
      cleanupOldData();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.error(`[STORAGE] Failed to set ${key} after cleanup:`, retryError);
        return false;
      }
    }
  };

  useEffect(() => {
    // Run cleanup on mount
    cleanupOldData();
    
    // Set up periodic cleanup every 5 minutes
    const interval = setInterval(cleanupOldData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    cleanupOldData,
    safeSetItem,
    getStorageSize
  };
};
