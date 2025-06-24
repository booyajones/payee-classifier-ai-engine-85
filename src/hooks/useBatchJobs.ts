
import { useState, useEffect } from 'react';
import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob } from '@/lib/storage/batchJobStorage';
import { batchJobService } from '@/services/batchJobService';

export const useBatchJobs = () => {
  const [batchJobs, setBatchJobs] = useState<StoredBatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const jobs = await batchJobService.loadJobs();
      setBatchJobs(jobs);
    } finally {
      setIsLoading(false);
    }
  };

  const addJob = async (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => {
    await batchJobService.addJob(batchJob, payeeNames, originalFileData);
    await loadJobs();
  };

  const updateJob = async (updatedJob: BatchJob) => {
    await batchJobService.updateJob(updatedJob);
    await loadJobs();
  };

  const deleteJob = async (jobId: string) => {
    await batchJobService.deleteJob(jobId);
    await loadJobs();
  };

  const getStorageInfo = () => batchJobService.getStorageInfo();

  return {
    batchJobs,
    isLoading,
    addJob,
    updateJob,
    deleteJob,
    getStorageInfo
  };
};
