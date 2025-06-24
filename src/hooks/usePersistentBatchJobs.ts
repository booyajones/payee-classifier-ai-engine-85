
import { useState, useEffect } from 'react';
import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob, isValidBatchJobId } from '@/lib/storage/batchJobStorage';
import { useStorageCleanup } from './useStorageCleanup';

const STORAGE_KEY = 'batchJobs';

export const usePersistentBatchJobs = () => {
  const [batchJobs, setBatchJobs] = useState<StoredBatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { safeSetItem } = useStorageCleanup();

  // Load jobs from localStorage on mount
  useEffect(() => {
    const loadJobs = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
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
            safeSetItem(STORAGE_KEY, JSON.stringify(validJobs));
          }
        }
      } catch (error) {
        console.error('[PERSISTENT JOBS] Error loading jobs from localStorage:', error);
        setBatchJobs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadJobs();
  }, [safeSetItem]);

  // Save jobs to localStorage whenever they change
  const saveJobs = (jobs: StoredBatchJob[]) => {
    try {
      const success = safeSetItem(STORAGE_KEY, JSON.stringify(jobs));
      if (!success) {
        console.error('[PERSISTENT JOBS] Failed to save jobs to localStorage');
      }
    } catch (error) {
      console.error('[PERSISTENT JOBS] Error saving jobs to localStorage:', error);
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

    const storedJob: StoredBatchJob = {
      ...batchJob,
      payeeNames,
      originalFileData,
      created_at: Date.now()
    };
    
    setBatchJobs(prev => {
      const newJobs = [storedJob, ...prev];
      saveJobs(newJobs);
      return newJobs;
    });
    
    console.log(`[PERSISTENT JOBS] Added job: ${batchJob.id}`);
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
      saveJobs(newJobs);
      return newJobs;
    });
    
    console.log(`[PERSISTENT JOBS] Updated job: ${updatedJob.id} (status: ${updatedJob.status})`);
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
    localStorage.removeItem(STORAGE_KEY);
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
    clearAllJobs
  };
};
