
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle } from "lucide-react";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { StoredBatchJob, isValidBatchJobId } from "@/lib/storage/batchJobStorage";
import StorageStatusIndicator from "./StorageStatusIndicator";
import ConfirmationDialog from "./ConfirmationDialog";
import EnhancedBatchJobCard from "./batch/EnhancedBatchJobCard";
import { useBatchJobs } from "@/hooks/useBatchJobs";
import { useJobPolling } from "@/hooks/useJobPolling";
import { useBatchJobActions } from "@/hooks/useBatchJobActions";

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

  const { batchJobs, isLoading, updateJob, deleteJob, getStorageInfo } = useBatchJobs();
  
  const handleJobCompleted = async (completedJob: BatchJob) => {
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

  if (isLoading) {
    return <div className="text-center">Loading batch jobs...</div>;
  }

  const validJobs = batchJobs.filter(job => isValidBatchJobId(job.id));
  const invalidJobsCount = batchJobs.length - validJobs.length;
  const sortedJobs = [...validJobs].sort((a, b) => b.created_at - a.created_at);
  const storageInfo = getStorageInfo();

  if (batchJobs.length === 0) {
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
        
        <h3 className="text-lg font-medium">Batch Jobs</h3>
        
        {invalidJobsCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {invalidJobsCount} invalid job(s) were filtered out.
            </AlertDescription>
          </Alert>
        )}
        
        {sortedJobs.map((job) => (
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
        ))}
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
