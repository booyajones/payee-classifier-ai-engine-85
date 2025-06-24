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

  // Add debugging to track state changes
  useEffect(() => {
    logger.info(`[USE BATCH JOBS] State updated - current jobs count: ${batchJobs.length}`);
    if (batchJobs.length > 0) {
      logger.info(`[USE BATCH JOBS] Current job IDs:`, batchJobs.map(job => ({
        id: job.id.slice(-8),
        status: job.status,
        created_at: job.created_at
      })));
    }
  }, [batchJobs]);

  const loadJobs = async () => {
    try {
      logger.info('[USE BATCH JOBS] Loading jobs...');
      setError(null);
      const jobs = await batchJobService.loadJobs();
      logger.info(`[USE BATCH JOBS] Loaded ${jobs.length} jobs from storage`);
      setBatchJobs(jobs);
      logger.info(`[USE BATCH JOBS] State set with ${jobs.length} jobs`);
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
      logger.info(`[USE BATCH JOBS] === STARTING ADD JOB PROCESS ===`);
      logger.info(`[USE BATCH JOBS] Adding job: ${batchJob.id}`);
      logger.info(`[USE BATCH JOBS] Current jobs count before add: ${batchJobs.length}`);
      setError(null);
      
      // Create the stored job object first
      const newStoredJob: StoredBatchJob = {
        ...batchJob,
        payeeNames,
        originalFileData: originalFileData.length < 1000 ? originalFileData : [],
        created_at: Date.now()
      };
      
      logger.info(`[USE BATCH JOBS] Created stored job object:`, {
        id: newStoredJob.id.slice(-8),
        status: newStoredJob.status,
        payeeCount: newStoredJob.payeeNames.length,
        created_at: newStoredJob.created_at
      });
      
      // IMMEDIATELY update the UI state first
      setBatchJobs(prev => {
        const newJobsList = [newStoredJob, ...prev];
        logger.info(`[USE BATCH JOBS] UI updated immediately - now showing ${newJobsList.length} jobs`);
        return newJobsList;
      });
      
      // Then save to storage in background
      await batchJobService.addJob(batchJob, payeeNames, originalFileData);
      logger.info('[USE BATCH JOBS] Job saved to storage successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add job';
      logger.error('[USE BATCH JOBS] Error adding job:', error);
      setError(errorMessage);
      // Revert optimistic update on error
      await loadJobs();
      throw error;
    }
  };

  const updateJob = async (updatedJob: BatchJob) => {
    try {
      logger.info(`[USE BATCH JOBS] Updating job: ${updatedJob.id}`);
      setError(null);
      
      // Update local state immediately for better UX
      setBatchJobs(prev => prev.map(job => 
        job.id === updatedJob.id 
          ? { ...job, ...updatedJob }
          : job
      ));
      
      // Update storage
      await batchJobService.updateJob(updatedJob);
      
      logger.info('[USE BATCH JOBS] Job updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update job';
      logger.error('[USE BATCH JOBS] Error updating job:', error);
      setError(errorMessage);
      // Revert on error
      await loadJobs();
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
