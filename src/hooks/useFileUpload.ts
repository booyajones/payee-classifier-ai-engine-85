
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { logger } from "@/lib/logger";
import { handleError, showErrorToast } from "@/lib/errorHandler";

interface UseFileUploadProps {
  onBatchJobCreated: (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => void;
}

export const useFileUpload = ({ onBatchJobCreated }: UseFileUploadProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const submitFileForProcessing = async (validationResult: any, selectedColumn: string) => {
    logger.info('[FILE UPLOAD] === STARTING BATCH JOB CREATION PROCESS ===');
    
    if (!validationResult || !selectedColumn) {
      const errorMsg = "Please select a file and column before submitting.";
      logger.error('[FILE UPLOAD] Validation failed:', errorMsg);
      toast({
        title: "Missing Information",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    if (!validationResult.payeeNames || validationResult.payeeNames.length === 0) {
      const errorMsg = "No payee names found in the selected column.";
      logger.error('[FILE UPLOAD] No payee names found:', errorMsg);
      toast({
        title: "No Data Found",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsRetrying(false);
    
    try {
      logger.info('[FILE UPLOAD] Starting batch job creation with:', {
        payeeCount: validationResult.payeeNames.length,
        originalDataCount: validationResult.originalData?.length || 0,
        selectedColumn,
        perfectAlignment: validationResult.payeeNames.length === (validationResult.originalData?.length || 0)
      });

      // Show immediate feedback
      toast({
        title: "Creating Batch Job",
        description: `Preparing to process ${validationResult.payeeNames.length} payees...`,
      });

      logger.info('[FILE UPLOAD] Importing createBatchJob function...');
      
      // Import the batch job creation function with timeout
      const importPromise = import("@/lib/openai/trueBatchAPI");
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Import timeout after 10 seconds')), 10000)
      );
      
      const { createBatchJob } = await Promise.race([importPromise, timeoutPromise]) as any;
      logger.info('[FILE UPLOAD] createBatchJob function imported successfully');
      
      // Create a real OpenAI batch job with timeout and retry logic
      logger.info('[FILE UPLOAD] Calling createBatchJob API...');
      
      const createJobPromise = createBatchJob(
        validationResult.payeeNames,
        `Payee classification for ${validationResult.payeeNames.length} payees from ${selectedColumn} column`
      );
      
      const apiTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout after 30 seconds')), 30000)
      );
      
      const batchJob = await Promise.race([createJobPromise, apiTimeoutPromise]) as BatchJob;
      
      logger.info('[FILE UPLOAD] Batch job created successfully:', {
        id: batchJob.id.slice(-8),
        status: batchJob.status,
        created_at: batchJob.created_at
      });

      // Show success feedback
      toast({
        title: "Batch Job Created",
        description: `Job ${batchJob.id.slice(-8)} created successfully. Adding to your jobs list...`,
      });

      logger.info('[FILE UPLOAD] Calling onBatchJobCreated callback...');
      await onBatchJobCreated(
        batchJob,
        validationResult.payeeNames,
        validationResult.originalData || []
      );
      
      logger.info('[FILE UPLOAD] onBatchJobCreated callback completed successfully');
      logger.info('[FILE UPLOAD] === BATCH JOB CREATION PROCESS COMPLETED ===');

    } catch (error) {
      logger.error('[FILE UPLOAD] === BATCH JOB CREATION FAILED ===');
      logger.error('[FILE UPLOAD] Error details:', error);
      
      const appError = handleError(error, 'Batch job creation');
      
      // Show detailed error information
      let errorTitle = "Batch Job Creation Failed";
      let errorDescription = appError.message;
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorTitle = "Request Timeout";
          errorDescription = "The request took too long. Please check your internet connection and try again.";
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          errorTitle = "API Quota Exceeded";
          errorDescription = "OpenAI API quota exceeded. Please try again later or check your usage limits.";
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
          errorTitle = "Authentication Failed";
          errorDescription = "Please check your OpenAI API key in the settings.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorTitle = "Network Error";
          errorDescription = "Please check your internet connection and try again.";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
      
      // Log additional debugging information
      logger.error('[FILE UPLOAD] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      logger.error('[FILE UPLOAD] Current environment check:', {
        hasWindow: typeof window !== 'undefined',
        hasProcess: typeof process !== 'undefined',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
      });
      
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
      logger.info('[FILE UPLOAD] === BATCH JOB CREATION PROCESS ENDED ===');
    }
  };

  return {
    isLoading,
    isRetrying,
    retryCount,
    submitFileForProcessing
  };
};
