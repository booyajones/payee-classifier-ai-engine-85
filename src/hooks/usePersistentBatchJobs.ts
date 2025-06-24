import { useState, useEffect } from 'react';
import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob, isValidBatchJobId } from '@/lib/storage/batchJobStorage';
import { useFallbackStorage } from './useFallbackStorage';

const STORAGE_KEY = 'batchJobs';

export const usePersistentBatchJobs = () => {
  const [batchJobs, setBatchJobs] = useState<StoredBatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setItem, getItem, removeItem, isUsingFallback, storageStatus } = useFallbackStorage();

  // Load jobs from storage on mount
  useEffect(() => {
    const loadJobs = () => {
      try {
        const stored = getItem(STORAGE_KEY);
        if (stored) {
          const jobs: StoredBatchJob[] = JSON.parse(stored);
          
          // Filter out invalid jobs during load
          const validJobs = jobs.filter(job => {
            const isValid = isValidBatchJobId(job.id);
            if (!isValid) {
              console.warn(`[PERSISTENT JOBS] Removing invalid job on load: ${job.id}`);
            }
            return isValid;
          });
          
          console.log(`[PERSISTENT JOBS] Loaded ${validJobs.length} valid jobs (${jobs.length - validJobs.length} invalid filtered)`);
          setBatchJobs(validJobs);
          
          // Save back the cleaned list if we filtered anything
          if (validJobs.length !== jobs.length) {
            saveJobs(validJobs);
          }
        }
      } catch (error) {
        console.error('[PERSISTENT JOBS] Error loading jobs from storage:', error);
        setBatchJobs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadJobs();
  }, [getItem]);

  // Save jobs to storage with fallback
  const saveJobs = (jobs: StoredBatchJob[]): boolean => {
    try {
      const success = setItem(STORAGE_KEY, JSON.stringify(jobs));
      if (!success) {
        console.error('[PERSISTENT JOBS] Failed to save jobs to storage');
      }
      return success;
    } catch (error) {
      console.error('[PERSISTENT JOBS] Error saving jobs to storage:', error);
      return false;
    }
  };

  const addJob = async (
    batchJob: BatchJob, 
    payeeNames: string[], 
    originalFileData: any[]
  ): Promise<void> => {
    if (!isValidBatchJobId(batchJob.id)) {
      console.error(`[PERSISTENT JOBS] Cannot add invalid job ID: ${batchJob.id}`);
      throw new Error(`Invalid batch job ID format: ${batchJob.id}`);
    }

    // Don't store originalFileData if storage is constrained
    const shouldStoreFileData = !isUsingFallback && originalFileData.length < 1000;
    
    const storedJob: StoredBatchJob = {
      ...batchJob,
      payeeNames,
      originalFileData: shouldStoreFileData ? originalFileData : [], // Store empty array if too large
      created_at: Date.now()
    };
    
    setBatchJobs(prev => {
      const newJobs = [storedJob, ...prev];
      const saved = saveJobs(newJobs);
      
      // If save failed, keep only essential jobs in memory
      if (!saved && isUsingFallback) {
        const essentialJobs = newJobs.filter(job => 
          ['in_progress', 'validating', 'finalizing'].includes(job.status)
        ).slice(0, 5); // Keep only 5 most important jobs
        return essentialJobs;
      }
      
      return newJobs;
    });
    
    console.log(`[PERSISTENT JOBS] Added job: ${batchJob.id} (storage: ${storageStatus})`);
  };

  const updateJob = (updatedJob: BatchJob): void => {
    if (!isValidBatchJobId(updatedJob.id)) {
      console.error(`[PERSISTENT JOBS] Cannot update invalid job ID: ${updatedJob.id}`);
      return;
    }

    setBatchJobs(prev => {
      const newJobs = prev.map(job => 
        job.id === updatedJob.id 
          ? { ...job, ...updatedJob }
          : job
      );
      
      const saved = saveJobs(newJobs);
      
      // Critical: Always update the UI state even if storage fails
      console.log(`[PERSISTENT JOBS] Updated job: ${updatedJob.id} (status: ${updatedJob.status}, storage: ${saved ? 'success' : 'failed'})`);
      
      return newJobs;
    });
  };

  const deleteJob = (jobId: string): void => {
    setBatchJobs(prev => {
      const newJobs = prev.filter(job => job.id !== jobId);
      saveJobs(newJobs);
      return newJobs;
    });
    
    console.log(`[PERSISTENT JOBS] Deleted job: ${jobId}`);
  };

  const getJobById = (jobId: string): StoredBatchJob | undefined => {
    return batchJobs.find(job => job.id === jobId);
  };

  const getJobsByStatus = (status: string): StoredBatchJob[] => {
    return batchJobs.filter(job => job.status === status);
  };

  const clearAllJobs = (): void => {
    setBatchJobs([]);
    removeItem(STORAGE_KEY);
    console.log('[PERSISTENT JOBS] Cleared all jobs');
  };

  return {
    batchJobs,
    isLoading,
    addJob,
    updateJob,
    deleteJob,
    getJobById,
    getJobsByStatus,
    clearAllJobs,
    storageStatus,
    isUsingFallback
  };
};
