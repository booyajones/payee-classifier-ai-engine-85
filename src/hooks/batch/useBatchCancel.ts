
import { cancelBatchJob } from "@/lib/openai/trueBatchAPI";
import { handleError, showErrorToast } from "@/lib/errorHandler";
import { isValidBatchJobId } from "@/lib/storage/batchJobStorage";
import { logger } from '@/lib/logger';

interface UseBatchCancelProps {
  onJobUpdate: (job: any) => void;
  onJobDelete: (jobId: string) => void;
  toast: any;
}

export const useBatchCancel = ({ onJobUpdate, onJobDelete, toast }: UseBatchCancelProps) => {
  const handleCancelJob = async (jobId: string) => {
    if (!isValidBatchJobId(jobId)) {
      toast({
        title: "Invalid Job ID",
        description: "Cannot cancel job with invalid ID.",
        variant: "destructive"
      });
      return;
    }

    try {
      logger.info(`[BATCH MANAGER] Cancelling job ${jobId}`);
      const cancelledJob = await cancelBatchJob(jobId);
      onJobUpdate(cancelledJob);
      
      toast({
        title: "Job Cancelled",
        description: `Batch job ${jobId.slice(-8)} has been cancelled successfully.`,
      });
    } catch (error) {
      const appError = handleError(error, 'Job Cancellation');
      logger.error(`[BATCH MANAGER] Error cancelling job ${jobId}:`, error);
      
      // Handle 404 errors specifically
      if (error instanceof Error && error.message.includes('404')) {
        toast({
          title: "Job Not Found",
          description: `Batch job ${jobId.slice(-8)} was not found on OpenAI's servers. Removing from list.`,
          variant: "destructive"
        });
        onJobDelete(jobId);
      } else {
        showErrorToast(appError, 'Job Cancellation');
      }
    }
  };

  return {
    handleCancelJob
  };
};
