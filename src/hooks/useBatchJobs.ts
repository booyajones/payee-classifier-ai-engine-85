
import { useState, useEffect } from 'react';
import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob } from '@/lib/storage/batchJobStorage';
import { batchJobService } from '@/services/batchJobService';
import { logger } from '@/lib/logger';

export const useBatchJobs = () => {
  const [batchJobs, setBatchJobs] = useState<StoredBatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      logger.info('[USE BATCH JOBS] Loading jobs...');
      setError(null);
      const jobs = await batchJobService.loadJobs();
      logger.info(`[USE BATCH JOBS] Loaded ${jobs.length} jobs, updating state`);
      setBatchJobs(jobs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load jobs';
      logger.error('[USE BATCH JOBS] Error loading jobs:', error);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const addJob = async (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => {
    try {
      logger.info(`[USE BATCH JOBS] Adding job: ${batchJob.id}`);
      setError(null);
      
      // Add to storage first
      await batchJobService.addJob(batchJob, payeeNames, originalFileData);
      logger.info('[USE BATCH JOBS] Job added to storage successfully');
      
      // Immediately update the UI state with the new job
      const newStoredJob: StoredBatchJob = {
        ...batchJob,
        payeeNames,
        originalFileData: originalFileData.length < 1000 ? originalFileData : [],
        created_at: Date.now()
      };
      
      setBatchJobs(prev => [newStoredJob, ...prev]);
      logger.info('[USE BATCH JOBS] UI state updated with new job');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add job';
      logger.error('[USE BATCH JOBS] Error adding job:', error);
      setError(errorMessage);
      throw error;
    }
  };

  const updateJob = async (updatedJob: BatchJob) => {
    try {
      logger.info(`[USE BATCH JOBS] Updating job: ${updatedJob.id}`);
      setError(null);
      
      // Update storage
      await batchJobService.updateJob(updatedJob);
      
      // Update local state immediately for better UX
      setBatchJobs(prev => prev.map(job => 
        job.id === updatedJob.id 
          ? { ...job, ...updatedJob }
          : job
      ));
      
      logger.info('[USE BATCH JOBS] Job updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update job';
      logger.error('[USE BATCH JOBS] Error updating job:', error);
      setError(errorMessage);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      logger.info(`[USE BATCH JOBS] Deleting job: ${jobId}`);
      setError(null);
      
      // Update local state immediately
      setBatchJobs(prev => prev.filter(job => job.id !== jobId));
      
      // Then update storage
      await batchJobService.deleteJob(jobId);
      
      logger.info('[USE BATCH JOBS] Job deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete job';
      logger.error('[USE BATCH JOBS] Error deleting job:', error);
      setError(errorMessage);
      // Revert the optimistic update on error
      await loadJobs();
    }
  };

  const getStorageInfo = () => batchJobService.getStorageInfo();

  return {
    batchJobs,
    isLoading,
    error,
    addJob,
    updateJob,
    deleteJob,
    getStorageInfo,
    refreshJobs: loadJobs
  };
};
