
import { useState } from "react";
import { checkBatchJobStatus } from "@/lib/openai/trueBatchAPI";
import { isValidBatchJobId } from "@/lib/storage/batchJobStorage";
import { logger } from '@/lib/logger';

interface UseBatchRefreshProps {
  onJobDelete: (jobId: string) => void;
  toast: any;
}

export const useBatchRefresh = ({ onJobDelete, toast }: UseBatchRefreshProps) => {
  const [refreshingJobs, setRefreshingJobs] = useState<Set<string>>(new Set());

  const handleManualRefresh = async (jobId: string, manualRefresh: (jobId: string) => Promise<any>) => {
    if (!isValidBatchJobId(jobId)) {
      toast({
        title: "Invalid Job ID",
        description: `Job ID ${jobId} is not a valid OpenAI batch job ID. Removing from list.`,
        variant: "destructive"
      });
      onJobDelete(jobId);
      return;
    }

    setRefreshingJobs(prev => new Set(prev).add(jobId));
    try {
      logger.info(`[BATCH MANAGER] Manual refresh for job ${jobId}`);
      await manualRefresh(jobId);
    } catch (error) {
      logger.error(`[BATCH MANAGER] Manual refresh failed for job ${jobId}:`, error);
      
      // Handle 404 errors specifically
      if (error instanceof Error && error.message.includes('404')) {
        toast({
          title: "Job Not Found",
          description: `Batch job ${jobId.slice(-8)} was not found on OpenAI's servers. It may have been deleted or expired. Removing from list.`,
          variant: "destructive"
        });
        onJobDelete(jobId);
      }
    } finally {
      setRefreshingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  return {
    refreshingJobs,
    handleManualRefresh
  };
};
