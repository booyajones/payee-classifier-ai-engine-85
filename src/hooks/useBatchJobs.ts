
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
      
      await batchJobService.addJob(batchJob, payeeNames, originalFileData);
      logger.info('[USE BATCH JOBS] Job added successfully, reloading jobs list');
      
      // Reload jobs to ensure UI is updated
      await loadJobs();
      
      logger.info('[USE BATCH JOBS] Jobs list reloaded after adding new job');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add job';
      logger.error('[USE BATCH JOBS] Error adding job:', error);
      setError(errorMessage);
      throw error; // Re-throw so calling code can handle it
    }
  };

  const updateJob = async (updatedJob: BatchJob) => {
    try {
      logger.info(`[USE BATCH JOBS] Updating job: ${updatedJob.id}`);
      setError(null);
      
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
      
      await batchJobService.deleteJob(jobId);
      
      // Update local state immediately
      setBatchJobs(prev => prev.filter(job => job.id !== jobId));
      
      logger.info('[USE BATCH JOBS] Job deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete job';
      logger.error('[USE BATCH JOBS] Error deleting job:', error);
      setError(errorMessage);
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
