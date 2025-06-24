
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle } from "lucide-react";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { useBatchJobPolling } from "@/hooks/useBatchJobPolling";
import { StoredBatchJob, isValidBatchJobId } from "@/lib/storage/batchJobStorage";
import { useStorageCleanup } from "@/hooks/useStorageCleanup";
import ConfirmationDialog from "./ConfirmationDialog";
import EnhancedBatchJobCard from "./batch/EnhancedBatchJobCard";
import { useBatchJobActions } from "@/hooks/useBatchJobActions";

interface BatchJobManagerProps {
  jobs: StoredBatchJob[];
  onJobUpdate: (job: BatchJob) => void;
  onJobComplete: (results: PayeeClassification[], summary: BatchProcessingResult, jobId: string) => void;
  onJobDelete: (jobId: string) => void;
}

const BatchJobManager = ({ 
  jobs, 
  onJobUpdate, 
  onJobComplete, 
  onJobDelete 
}: BatchJobManagerProps) => {
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
  const { cleanupOldData } = useStorageCleanup();

  // Debug logging for job validation
  console.log(`[BATCH MANAGER] Processing ${jobs.length} total jobs`);
  jobs.forEach((job, index) => {
    console.log(`[BATCH MANAGER] Job ${index}:`, {
      id: job.id,
      idLength: job.id?.length,
      isValidId: isValidBatchJobId(job.id),
      status: job.status,
      payeeCount: job.payeeNames?.length
    });
  });

  // Filter out invalid job IDs
  const validJobs = jobs.filter(job => {
    const isValid = isValidBatchJobId(job.id);
    if (!isValid) {
      console.log(`[BATCH MANAGER] Filtering out invalid job:`, job.id);
    }
    return isValid;
  });

  console.log(`[BATCH MANAGER] After filtering: ${validJobs.length} valid jobs out of ${jobs.length} total`);

  // Handle auto-download when jobs complete
  const handleJobCompleted = async (completedJob: BatchJob) => {
    console.log(`[BATCH MANAGER] Auto-downloading results for completed job: ${completedJob.id}`);
    
    try {
      // Find the stored job data
      const storedJob = validJobs.find(j => j.id === completedJob.id);
      if (!storedJob) {
        console.error(`[BATCH MANAGER] Could not find stored job data for ${completedJob.id}`);
        toast({
          title: "Auto-Download Failed",
          description: `Could not find job data for ${completedJob.id.slice(-8)}. Try manual download.`,
          variant: "destructive",
        });
        return;
      }
      
      // Trigger download using the batch job actions
      await handleDownloadResults(storedJob);
      
    } catch (error) {
      console.error(`[BATCH MANAGER] Auto-download failed for job ${completedJob.id}:`, error);
      toast({
        title: "Auto-Download Failed",
        description: `Failed to auto-download results for job ${completedJob.id.slice(-8)}. You can try downloading manually.`,
        variant: "destructive",
      });
    }
  };

  // Use the polling hook with completion callback
  const { pollingStates, manualRefresh } = useBatchJobPolling(
    validJobs, 
    onJobUpdate,
    handleJobCompleted
  );

  // Use the batch job actions hook
  const {
    refreshingJobs,
    downloadingJobs,
    handleManualRefresh,
    handleDownloadResults,
    handleCancelJob
  } = useBatchJobActions({
    validJobs,
    manualRefresh,
    onJobUpdate,
    onJobComplete,
    onJobDelete,
    toast
  });

  const showCancelConfirmation = (jobId: string) => {
    const job = validJobs.find(j => j.id === jobId);
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Batch Job',
      description: `Are you sure you want to cancel job ${jobId.slice(-8)}? This action cannot be undone and you may be charged for completed requests.`,
      onConfirm: () => handleCancelJob(jobId),
      variant: 'destructive'
    });
  };

  const showDeleteConfirmation = (jobId: string) => {
    const job = validJobs.find(j => j.id === jobId);
    const jobStatus = job?.status || 'unknown';
    
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Job from List',
      description: `Are you sure you want to remove job ${jobId.slice(-8)} (${jobStatus}) from your list? This will only remove it from your view and local storage, not delete the actual OpenAI batch job.`,
      onConfirm: () => {
        onJobDelete(jobId);
        cleanupOldData(); // Cleanup storage after deletion
        toast({
          title: "Job Removed",
          description: `Job ${jobId.slice(-8)} has been removed from your list.`,
        });
      },
      variant: 'destructive'
    });
  };

  // Sort jobs by creation date in descending order (most recent first)
  const sortedJobs = [...validJobs].sort((a, b) => b.created_at - a.created_at);

  if (jobs.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No batch jobs found. Submit a batch for processing to see jobs here.
        </AlertDescription>
      </Alert>
    );
  }

  // Show warning if some jobs were filtered out
  const invalidJobsCount = jobs.length - validJobs.length;

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Batch Jobs</h3>
        
        {invalidJobsCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {invalidJobsCount} invalid job(s) were filtered out. 
              Check console logs for details about job ID validation.
              Expected format: batch_[alphanumeric characters, 15+ length]
            </AlertDescription>
          </Alert>
        )}
        
        {sortedJobs.map((job) => {
          const pollingState = pollingStates[job.id];
          const isJobRefreshing = refreshingJobs.has(job.id);
          const isJobDownloading = downloadingJobs.has(job.id);
          const payeeCount = job.payeeNames?.length || 0;
          
          return (
            <EnhancedBatchJobCard
              key={job.id}
              job={job}
              pollingState={pollingState}
              payeeCount={payeeCount}
              isRefreshing={isJobRefreshing}
              isDownloading={isJobDownloading}
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
