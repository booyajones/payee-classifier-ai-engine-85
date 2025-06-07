
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { BatchJob, getBatchJobResults, cancelBatchJob } from "@/lib/openai/trueBatchAPI";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { createPayeeClassification } from "@/lib/utils";
import { useBatchJobPolling } from "@/hooks/useBatchJobPolling";
import { handleError, showErrorToast, showRetryableErrorToast } from "@/lib/errorHandler";
import { useRetry } from "@/hooks/useRetry";
import { checkKeywordExclusion } from "@/lib/classification/enhancedKeywordExclusion";
import { StoredBatchJob, isValidBatchJobId } from "@/lib/storage/batchJobStorage";
import ConfirmationDialog from "./ConfirmationDialog";
import BatchJobCard from "./batch/BatchJobCard";

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
  const [refreshingJobs, setRefreshingJobs] = useState<Set<string>>(new Set());
  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set());
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

  // Filter out invalid job IDs before polling
  const validJobs = jobs.filter(job => isValidBatchJobId(job.id));

  // Use the polling hook (no auto-start)
  const { pollingStates, manualRefresh } = useBatchJobPolling(validJobs, onJobUpdate);

  // Retry mechanism for operations
  const {
    execute: downloadResultsWithRetry,
    isRetrying: isDownloadRetrying
  } = useRetry(getBatchJobResults, { maxRetries: 3, baseDelay: 2000 });

  // Manual refresh - triggers single check + starts auto-polling
  const handleManualRefresh = async (jobId: string) => {
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
      console.log(`[BATCH MANAGER] Manual refresh for job ${jobId}`);
      await manualRefresh(jobId);
    } catch (error) {
      console.error(`[BATCH MANAGER] Manual refresh failed for job ${jobId}:`, error);
      
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

  const handleDownloadResults = async (job: StoredBatchJob) => {
    if (!isValidBatchJobId(job.id)) {
      toast({
        title: "Invalid Job ID",
        description: "Cannot download results for invalid job ID.",
        variant: "destructive"
      });
      return;
    }

    setDownloadingJobs(prev => new Set(prev).add(job.id));
    
    try {
      console.log(`[BATCH MANAGER] Downloading results for job ${job.id} with GUARANTEED alignment`);
      const payeeNames = job.payeeNames || [];
      const originalFileData = job.originalFileData || [];
      
      console.log(`[BATCH MANAGER] Data verification:`, {
        payeeNamesLength: payeeNames.length,
        originalDataLength: originalFileData.length,
        perfectAlignment: payeeNames.length === originalFileData.length
      });
      
      if (payeeNames.length === 0) {
        throw new Error('No payee names found for this job. The job data may be corrupted.');
      }

      if (payeeNames.length !== originalFileData.length) {
        console.error(`[BATCH MANAGER] CRITICAL ALIGNMENT ERROR: payee names (${payeeNames.length}) != original data (${originalFileData.length})`);
        throw new Error(`Data alignment error: ${payeeNames.length} payees but ${originalFileData.length} original rows. Cannot proceed safely.`);
      }

      // Create sequential row indexes to guarantee 1:1 correspondence
      const originalRowIndexes = Array.from({ length: payeeNames.length }, (_, i) => i);

      // Get raw results from OpenAI with guaranteed index alignment
      const rawResults = await downloadResultsWithRetry(job, payeeNames, originalRowIndexes);
      
      console.log(`[BATCH MANAGER] Processing ${rawResults.length} results with PERFECT alignment`);
      
      // Process results maintaining exact 1:1 correspondence
      const classifications = payeeNames.map((name, arrayIndex) => {
        const rawResult = rawResults[arrayIndex];
        const originalRowIndex = arrayIndex; // Perfect 1:1 correspondence
        const originalRowData = originalFileData[arrayIndex] || {};
        
        console.log(`[BATCH MANAGER] Processing row ${arrayIndex}: "${name}" with guaranteed alignment`);
        
        // Apply keyword exclusion check
        const keywordExclusion = checkKeywordExclusion(name);
        
        // Create classification result - NO FALLBACKS
        let classification: 'Business' | 'Individual' = 'Individual';
        let confidence = 50;
        let reasoning = 'Default classification';
        let processingTier: any = 'Default';
        
        if (keywordExclusion.isExcluded) {
          // Override with keyword exclusion
          classification = 'Business';
          confidence = keywordExclusion.confidence;
          reasoning = keywordExclusion.reasoning;
          processingTier = 'Excluded';
        } else if (rawResult?.status === 'success') {
          // Use OpenAI result
          classification = rawResult.classification || 'Individual';
          confidence = rawResult.confidence || 50;
          reasoning = rawResult.reasoning || 'AI classification';
          processingTier = 'AI-Powered';
        } else if (rawResult?.status === 'error') {
          // Handle API errors properly
          classification = 'Individual';
          confidence = 0;
          reasoning = `API Error: ${rawResult.error || 'Unknown error'}`;
          processingTier = 'Failed';
        }
        
        return createPayeeClassification(name, {
          classification,
          confidence,
          reasoning,
          processingTier,
          keywordExclusion,
          processingMethod: keywordExclusion.isExcluded ? 'Keyword Exclusion' : 'OpenAI Batch API'
        }, originalRowData, originalRowIndex);
      });

      const successCount = classifications.filter(c => 
        c.result.processingTier !== 'Failed'
      ).length;
      const failureCount = classifications.length - successCount;

      console.log(`[BATCH MANAGER] Creating summary with PERFECT alignment:`, {
        classificationsLength: classifications.length,
        originalFileDataLength: originalFileData.length,
        perfectAlignment: classifications.length === originalFileData.length
      });

      const summary: BatchProcessingResult = {
        results: classifications,
        successCount,
        failureCount,
        originalFileData
      };

      onJobComplete(classifications, summary, job.id);

      toast({
        title: "Results Downloaded Successfully", 
        description: `Downloaded ${successCount} successful classifications${failureCount > 0 ? ` and ${failureCount} failed attempts` : ''} with GUARANTEED 1:1 data alignment.`,
      });
    } catch (error) {
      const appError = handleError(error, 'Results Download');
      console.error(`[BATCH MANAGER] Error downloading results for job ${job.id}:`, error);
      
      // Handle 404 errors specifically
      if (error instanceof Error && error.message.includes('404')) {
        toast({
          title: "Job Not Found",
          description: `Batch job ${job.id.slice(-8)} was not found on OpenAI's servers. It may have been deleted or expired. Removing from list.`,
          variant: "destructive"
        });
        onJobDelete(job.id);
      } else {
        showRetryableErrorToast(
          appError, 
          () => handleDownloadResults(job),
          'Results Download'
        );
      }
    } finally {
      setDownloadingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id);
        return newSet;
      });
    }
  };

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
      console.log(`[BATCH MANAGER] Cancelling job ${jobId}`);
      const cancelledJob = await cancelBatchJob(jobId);
      onJobUpdate(cancelledJob);
      
      toast({
        title: "Job Cancelled",
        description: `Batch job ${jobId.slice(-8)} has been cancelled successfully.`,
      });
    } catch (error) {
      const appError = handleError(error, 'Job Cancellation');
      console.error(`[BATCH MANAGER] Error cancelling job ${jobId}:`, error);
      
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

  const showCancelConfirmation = (jobId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Batch Job',
      description: `Are you sure you want to cancel job ${jobId.slice(-8)}? This action cannot be undone and you may be charged for completed requests.`,
      onConfirm: () => handleCancelJob(jobId),
      variant: 'destructive'
    });
  };

  const showDeleteConfirmation = (jobId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Job',
      description: `Are you sure you want to remove job ${jobId.slice(-8)} from the list? This will only remove it from your view, not delete the actual job.`,
      onConfirm: () => onJobDelete(jobId),
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
              {invalidJobsCount} invalid job(s) were filtered out. Only valid OpenAI batch job IDs are displayed.
            </AlertDescription>
          </Alert>
        )}
        
        {sortedJobs.map((job) => {
          const pollingState = pollingStates[job.id];
          const isJobRefreshing = refreshingJobs.has(job.id);
          const isJobDownloading = downloadingJobs.has(job.id);
          const payeeCount = job.payeeNames?.length || 0;
          
          return (
            <BatchJobCard
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
        confirmText={confirmDialog.variant === 'destructive' ? 'Delete' : 'Continue'}
      />
    </>
  );
};

export default BatchJobManager;
