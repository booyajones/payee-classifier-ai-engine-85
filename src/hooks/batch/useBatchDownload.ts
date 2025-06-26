
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
        console.warn(`[BATCH MANAGER] No payee names found for job ${job.id}`);
        throw new Error('No payee names found for this job. The job data may be corrupted.');
      }

      // Always preserve original data - gracefully handle missing data
      const hasOriginalData = originalFileData.length > 0;
      
      if (!hasOriginalData) {
        console.warn(`[BATCH MANAGER] No original data found for job ${job.id} - will create fallback structure`);
      }

      // Handle data alignment - be more flexible
      let alignedOriginalData = originalFileData;
      if (hasOriginalData && originalFileData.length !== payeeNames.length) {
        console.warn(`[BATCH MANAGER] Data length mismatch: ${originalFileData.length} original vs ${payeeNames.length} payees - will align data`);
        
        // Try to align data or create fallback
        if (originalFileData.length > payeeNames.length) {
          alignedOriginalData = originalFileData.slice(0, payeeNames.length);
        } else {
          // Extend with fallback data
          alignedOriginalData = [...originalFileData];
          for (let i = originalFileData.length; i < payeeNames.length; i++) {
            alignedOriginalData.push({
              'Row_Number': i + 1,
              'Payee_Name': payeeNames[i],
              'Original_Source': 'Data alignment fallback'
            });
          }
        }
      }

      // Create sequential row indexes with perfect 1:1 correspondence
      const originalRowIndexes = Array.from({ length: payeeNames.length }, (_, i) => i);

      // Get raw results from OpenAI with guaranteed index alignment
      const rawResults = await downloadResultsWithRetry(latestJob, payeeNames, originalRowIndexes);
      
      console.log(`[BATCH MANAGER] Processing ${rawResults.length} results with alignment`);
      
      // Process results maintaining correspondence
      const classifications = payeeNames.map((name, arrayIndex) => {
        const rawResult = rawResults[arrayIndex];
        const originalRowIndex = arrayIndex; // Perfect 1:1 correspondence
        
        // Get original row data or create fallback
        let originalRowData = null;
        if (hasOriginalData && alignedOriginalData[arrayIndex]) {
          originalRowData = alignedOriginalData[arrayIndex];
        } else {
          // Create fallback original data
          originalRowData = {
            'Row_Number': arrayIndex + 1,
            'Payee_Name': name,
            'Data_Source': 'Fallback - original data not preserved'
          };
        }
        
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

      // Create the summary with original data (or fallback)
      const summary: BatchProcessingResult = {
        results: classifications,
        successCount,
        failureCount,
        originalFileData: hasOriginalData ? alignedOriginalData : classifications.map(c => c.originalData).filter(Boolean)
      };

      onJobComplete(classifications, summary, job.id);

      toast({
        title: "Results Downloaded Successfully", 
        description: `Downloaded ${successCount} successful classifications${failureCount > 0 ? ` and ${failureCount} failed attempts` : ''}${!hasOriginalData ? ' (using fallback data structure)' : ''}.`,
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
        toast({
          title: "Download Failed",
          description: `Failed to download results for job ${job.id.slice(-8)}. ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
    } finally {
      // Always clear the downloading state
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
