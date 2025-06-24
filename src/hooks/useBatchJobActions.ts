
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { StoredBatchJob } from "@/lib/storage/batchJobStorage";
import { useBatchRefresh, useBatchDownload, useBatchCancel } from "@/hooks/batch";

interface UseBatchJobActionsProps {
  validJobs: StoredBatchJob[];
  manualRefresh: (jobId: string) => Promise<any>;
  onJobUpdate: (job: any) => void;
  onJobComplete: (results: PayeeClassification[], summary: BatchProcessingResult, jobId: string) => void;
  onJobDelete: (jobId: string) => void;
  toast: any;
}

export const useBatchJobActions = ({
  validJobs,
  manualRefresh,
  onJobUpdate,
  onJobComplete,
  onJobDelete,
  toast
}: UseBatchJobActionsProps) => {
  const { refreshingJobs, handleManualRefresh } = useBatchRefresh({
    onJobDelete,
    toast
  });

  const { downloadingJobs, handleDownloadResults, isDownloadRetrying } = useBatchDownload({
    onJobComplete,
    onJobDelete,
    toast
  });

  const { handleCancelJob } = useBatchCancel({
    onJobUpdate,
    onJobDelete,
    toast
  });

  // Wrap handleManualRefresh to include the manualRefresh callback
  const wrappedHandleManualRefresh = (jobId: string) => 
    handleManualRefresh(jobId, manualRefresh);

  return {
    refreshingJobs,
    downloadingJobs,
    handleManualRefresh: wrappedHandleManualRefresh,
    handleDownloadResults,
    handleCancelJob,
    isDownloadRetrying
  };
};
