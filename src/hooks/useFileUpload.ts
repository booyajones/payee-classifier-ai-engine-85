
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { logger } from "@/lib/logger";
import { isOpenAIInitialized, testOpenAIConnection } from "@/lib/openai/client";

interface UseFileUploadProps {
  onBatchJobCreated: (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => void;
}

export const useFileUpload = ({ onBatchJobCreated }: UseFileUploadProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const submitFileForProcessing = async (validationResult: any, selectedColumn: string) => {
    logger.info('[FILE UPLOAD] === STARTING BATCH JOB CREATION ===');
    logger.info('[FILE UPLOAD] Validation result:', {
      hasPayeeNames: !!validationResult?.payeeNames,
      payeeCount: validationResult?.payeeNames?.length || 0,
      selectedColumn,
      hasOriginalData: !!validationResult?.originalData
    });
    
    // Validate inputs first
    if (!validationResult || !selectedColumn) {
      const error = "Missing validation result or selected column";
      logger.error('[FILE UPLOAD] Input validation failed:', error);
      toast({
        title: "Missing Information",
        description: "Please select a file and column before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!validationResult.payeeNames || validationResult.payeeNames.length === 0) {
      const error = "No payee names found in validation result";
      logger.error('[FILE UPLOAD] No payee names:', error);
      toast({
        title: "No Data Found",
        description: "No payee names found in the selected column.",
        variant: "destructive",
      });
      return;
    }

    // Validate OpenAI connection before proceeding
    if (!isOpenAIInitialized()) {
      const error = "OpenAI not initialized";
      logger.error('[FILE UPLOAD] OpenAI not initialized');
      toast({
        title: "API Key Required",
        description: "Please set your OpenAI API key before creating batch jobs.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsRetrying(false);
    
    try {
      // Test API connection before creating batch job
      logger.info('[FILE UPLOAD] Testing OpenAI connection...');
      const isApiWorking = await testOpenAIConnection();
      if (!isApiWorking) {
        throw new Error("OpenAI API connection test failed. Please check your API key.");
      }
      logger.info('[FILE UPLOAD] OpenAI connection test passed');

      // Show immediate feedback
      toast({
        title: "Creating Batch Job",
        description: `Preparing to process ${validationResult.payeeNames.length} payees...`,
      });

      logger.info('[FILE UPLOAD] Importing createBatchJob function...');
      const { createBatchJob } = await import("@/lib/openai/trueBatchAPI");
      
      logger.info('[FILE UPLOAD] Calling createBatchJob with:', {
        payeeCount: validationResult.payeeNames.length,
        description: `Payee classification for ${validationResult.payeeNames.length} payees from ${selectedColumn} column`
      });

      // Add timeout wrapper for the API call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Batch job creation timed out after 30 seconds")), 30000)
      );

      const batchJob = await Promise.race([
        createBatchJob(
          validationResult.payeeNames,
          `Payee classification for ${validationResult.payeeNames.length} payees from ${selectedColumn} column`
        ),
        timeoutPromise
      ]) as BatchJob;
      
      logger.info('[FILE UPLOAD] ✅ Batch job created successfully:', {
        id: batchJob.id,
        shortId: batchJob.id.slice(-8),
        status: batchJob.status,
        created_at: batchJob.created_at
      });

      // Show success feedback
      toast({
        title: "Batch Job Created Successfully",
        description: `Job ${batchJob.id.slice(-8)} created and added to your list!`,
      });

      // Call the callback to add to UI - this is critical!
      logger.info('[FILE UPLOAD] Calling onBatchJobCreated callback...');
      await onBatchJobCreated(
        batchJob,
        validationResult.payeeNames,
        validationResult.originalData || []
      );
      logger.info('[FILE UPLOAD] ✅ onBatchJobCreated callback completed successfully');
      
    } catch (error) {
      logger.error('[FILE UPLOAD] ❌ Batch job creation failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        payeeCount: validationResult.payeeNames?.length,
        selectedColumn
      });
      
      // Determine error type and show appropriate message
      let errorMessage = "Failed to create batch job. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("quota") || error.message.includes("rate limit")) {
          errorMessage = "OpenAI API quota exceeded. Please try again later or check your billing.";
        } else if (error.message.includes("API key") || error.message.includes("authentication")) {
          errorMessage = "Invalid OpenAI API key. Please check your API key settings.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out. Please try again with a smaller file.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Batch Job Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
      logger.info('[FILE UPLOAD] === BATCH JOB CREATION PROCESS COMPLETED ===');
    }
  };

  return {
    isLoading,
    isRetrying,
    retryCount,
    submitFileForProcessing
  };
};
