
import { useState } from "react";
import { getBatchJobResults, checkBatchJobStatus } from "@/lib/openai/trueBatchAPI";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { createPayeeClassification } from "@/lib/utils";
import { handleError, showRetryableErrorToast } from "@/lib/errorHandler";
import { useRetry } from "@/hooks/useRetry";
import { checkKeywordExclusion } from "@/lib/classification/enhancedKeywordExclusion";
import { StoredBatchJob, isValidBatchJobId } from "@/lib/storage/batchJobStorage";

interface UseBatchDownloadProps {
  onJobComplete: (results: PayeeClassification[], summary: BatchProcessingResult, jobId: string) => void;
  onJobDelete: (jobId: string) => void;
  toast: any;
}

export const useBatchDownload = ({ onJobComplete, onJobDelete, toast }: UseBatchDownloadProps) => {
  const [downloadingJobs, setDownloadingJobs] = useState<Set<string>>(new Set());

  // Retry mechanism for operations
  const {
    execute: downloadResultsWithRetry,
    isRetrying: isDownloadRetrying
  } = useRetry(getBatchJobResults, { maxRetries: 3, baseDelay: 2000 });

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
      console.log(`[BATCH MANAGER] Starting download for job ${job.id}`);
      
      // First, get the latest job status to ensure it's actually completed
      const latestJob = await checkBatchJobStatus(job.id);
      console.log(`[BATCH MANAGER] Latest job status: ${latestJob.status}`);
      
      if (latestJob.status !== 'completed') {
        throw new Error(`Job is not completed. Current status: ${latestJob.status}`);
      }
      
      console.log(`[BATCH MANAGER] Downloading results for completed job ${job.id}`);
      const payeeNames = job.payeeNames || [];
      const originalFileData = job.originalFileData || [];
      
      console.log(`[BATCH MANAGER] Data verification:`, {
        payeeNamesLength: payeeNames.length,
        originalDataLength: originalFileData.length,
        hasOriginalData: originalFileData.length > 0
      });
      
      if (payeeNames.length === 0) {
        throw new Error('No payee names found for this job. The job data may be corrupted.');
      }

      // Check if we have original data alignment or if it was stripped for large files
      const hasOriginalData = originalFileData.length > 0;
      const isLargeFile = payeeNames.length > 1000; // Threshold for large files
      
      if (!hasOriginalData && isLargeFile) {
        console.log(`[BATCH MANAGER] Large file detected (${payeeNames.length} rows) - original data was not preserved to save memory`);
        toast({
          title: "Large File Processing",
          description: `Processing large file with ${payeeNames.length} payees. Original data structure wasn't preserved, but all classifications will be available.`,
        });
      } else if (!hasOriginalData) {
        console.error(`[BATCH MANAGER] CRITICAL: No original data found for job with ${payeeNames.length} payees`);
        throw new Error(`No original file data found. Cannot safely merge results.`);
      }

      // Create sequential row indexes
      const originalRowIndexes = Array.from({ length: payeeNames.length }, (_, i) => i);

      // Get raw results from OpenAI with guaranteed index alignment
      const rawResults = await downloadResultsWithRetry(latestJob, payeeNames, originalRowIndexes);
      
      console.log(`[BATCH MANAGER] Processing ${rawResults.length} results`);
      
      // Process results maintaining exact 1:1 correspondence
      const classifications = payeeNames.map((name, arrayIndex) => {
        const rawResult = rawResults[arrayIndex];
        const originalRowIndex = arrayIndex; // Perfect 1:1 correspondence
        
        // For large files without original data, create a minimal row structure
        const originalRowData = hasOriginalData 
          ? (originalFileData[arrayIndex] || {})
          : { payee_name: name }; // Fallback structure for large files
        
        console.log(`[BATCH MANAGER] Processing row ${arrayIndex}: "${name}"`);
        
        // Apply keyword exclusion check
        const keywordExclusion = checkKeywordExclusion(name);
        
        // Create classification result
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

      console.log(`[BATCH MANAGER] Creating summary for ${classifications.length} classifications`);

      // Create the summary with appropriate original data
      const summary: BatchProcessingResult = {
        results: classifications,
        successCount,
        failureCount,
        originalFileData: hasOriginalData ? originalFileData : [] // Empty for large files
      };

      onJobComplete(classifications, summary, job.id);

      const dataPreservationNote = hasOriginalData 
        ? "with full original data structure preserved"
        : "(original spreadsheet structure not preserved due to file size, but all classifications available)";

      toast({
        title: "Results Downloaded Successfully", 
        description: `Downloaded ${successCount} successful classifications${failureCount > 0 ? ` and ${failureCount} failed attempts` : ''} ${dataPreservationNote}.`,
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

  return {
    downloadingJobs,
    handleDownloadResults,
    isDownloadRetrying
  };
};
