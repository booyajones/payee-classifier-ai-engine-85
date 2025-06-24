import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { StoredBatchJob, isValidBatchJobId } from "@/lib/storage/batchJobStorage";
import StorageStatusIndicator from "./StorageStatusIndicator";
import ConfirmationDialog from "./ConfirmationDialog";
import EnhancedBatchJobCard from "./batch/EnhancedBatchJobCard";
import { useBatchJobs } from "@/hooks/useBatchJobs";
import { useJobPolling } from "@/hooks/useJobPolling";
import { useBatchJobActions } from "@/hooks/useBatchJobActions";
import { logger } from "@/lib/logger";

interface BatchJobManagerProps {
  onJobComplete: (results: PayeeClassification[], summary: BatchProcessingResult, jobId: string) => void;
}

const BatchJobManager = ({ onJobComplete }: BatchJobManagerProps) => {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });
  const { toast } = useToast();

  const { batchJobs, isLoading, error, updateJob, deleteJob, getStorageInfo, refreshJobs } = useBatchJobs();
  
  // Enhanced debugging for when jobs change
  useEffect(() => {
    logger.info(`[BATCH JOB MANAGER] Jobs updated - count: ${batchJobs.length}`);
    logger.info(`[BATCH JOB MANAGER] Current storage info:`, getStorageInfo());
    if (batchJobs.length > 0) {
      logger.info(`[BATCH JOB MANAGER] Job details:`, batchJobs.map(job => ({
        id: job.id.slice(-8),
        status: job.status,
        created_at: new Date(job.created_at).toLocaleTimeString()
      })));
    }
  }, [batchJobs]);
  
  const handleJobCompleted = async (completedJob: BatchJob) => {
    logger.info(`[BATCH JOB MANAGER] Job completed: ${completedJob.id}`);
    const storedJob = batchJobs.find(j => j.id === completedJob.id);
    if (storedJob) {
      await handleDownloadResults(storedJob);
    }
  };

  const { pollingStates, manualRefresh } = useJobPolling(
    updateJob,
    handleJobCompleted
  );

  const {
    refreshingJobs,
    downloadingJobs,
    handleManualRefresh,
    handleDownloadResults,
    handleCancelJob
  } = useBatchJobActions({
    validJobs: batchJobs,
    manualRefresh,
    onJobUpdate: updateJob,
    onJobComplete,
    onJobDelete: deleteJob,
    toast
  });

  const showCancelConfirmation = (jobId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Batch Job',
      description: `Are you sure you want to cancel job ${jobId.slice(-8)}?`,
      onConfirm: () => handleCancelJob(jobId),
      variant: 'destructive'
    });
  };

  const showDeleteConfirmation = (jobId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Job from List',
      description: `Remove job ${jobId.slice(-8)} from your list?`,
      onConfirm: () => deleteJob(jobId),
      variant: 'destructive'
    });
  };

  const handleRefreshJobs = async () => {
    logger.info('[BATCH JOB MANAGER] Manual refresh triggered');
    await refreshJobs();
    toast({
      title: "Jobs Refreshed",
      description: "Batch jobs list has been refreshed.",
    });
  };

  if (isLoading) {
    return <div className="text-center">Loading batch jobs...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading batch jobs: {error}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshJobs}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const validJobs = batchJobs.filter(job => isValidBatchJobId(job.id));
  const invalidJobsCount = batchJobs.length - validJobs.length;
  const sortedJobs = [...validJobs].sort((a, b) => b.created_at - a.created_at);
  const storageInfo = getStorageInfo();

  logger.info(`[BATCH JOB MANAGER] Rendering component - ${sortedJobs.length} valid jobs (${invalidJobsCount} invalid filtered)`);

  if (batchJobs.length === 0) {
    logger.info('[BATCH JOB MANAGER] No jobs to display - showing empty state');
    return (
      <>
        <StorageStatusIndicator 
          storageStatus={storageInfo.storageStatus} 
          isUsingFallback={storageInfo.isUsingFallback} 
        />
        <Alert>
          <AlertDescription>
            No batch jobs found. Submit a batch for processing to see jobs here.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <StorageStatusIndicator 
          storageStatus={storageInfo.storageStatus} 
          isUsingFallback={storageInfo.isUsingFallback} 
        />
        
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Batch Jobs ({sortedJobs.length})</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshJobs}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
        
        {invalidJobsCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {invalidJobsCount} invalid job(s) were filtered out.
            </AlertDescription>
          </Alert>
        )}
        
        {sortedJobs.map((job) => {
          logger.info(`[BATCH JOB MANAGER] Rendering job card for: ${job.id.slice(-8)}`);
          return (
            <EnhancedBatchJobCard
              key={job.id}
              job={job}
              pollingState={pollingStates[job.id]}
              payeeCount={job.payeeNames?.length || 0}
              isRefreshing={refreshingJobs.has(job.id)}
              isDownloading={downloadingJobs.has(job.id)}
              onManualRefresh={handleManualRefresh}
              onDownloadResults={handleDownloadResults}
              onCancelJob={showCancelConfirmation}
              onDeleteJob={showDeleteConfirmation}
            />
          );
        })}
      </div>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.variant === 'destructive' ? 'Yes, Remove' : 'Continue'}
      />
    </>
  );
};

export default BatchJobManager;
