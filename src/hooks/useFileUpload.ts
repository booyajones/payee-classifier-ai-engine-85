
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { logger } from "@/lib/logger";

interface UseFileUploadProps {
  onBatchJobCreated: (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => void;
}

export const useFileUpload = ({ onBatchJobCreated }: UseFileUploadProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const submitFileForProcessing = async (validationResult: any, selectedColumn: string) => {
    logger.info('[FILE UPLOAD] Starting batch job creation process');
    
    if (!validationResult || !selectedColumn) {
      toast({
        title: "Missing Information",
        description: "Please select a file and column before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!validationResult.payeeNames || validationResult.payeeNames.length === 0) {
      toast({
        title: "No Data Found",
        description: "No payee names found in the selected column.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsRetrying(false);
    
    try {
      logger.info('[FILE UPLOAD] Creating batch job...', {
        payeeCount: validationResult.payeeNames.length,
        selectedColumn
      });

      // Show immediate feedback
      toast({
        title: "Creating Batch Job",
        description: `Preparing to process ${validationResult.payeeNames.length} payees...`,
      });

      const { createBatchJob } = await import("@/lib/openai/trueBatchAPI");
      
      const batchJob = await createBatchJob(
        validationResult.payeeNames,
        `Payee classification for ${validationResult.payeeNames.length} payees from ${selectedColumn} column`
      );
      
      logger.info('[FILE UPLOAD] Batch job created successfully:', {
        id: batchJob.id.slice(-8),
        status: batchJob.status
      });

      // Show success feedback
      toast({
        title: "Batch Job Created",
        description: `Job ${batchJob.id.slice(-8)} created successfully!`,
      });

      // Immediately call the callback to add to UI
      await onBatchJobCreated(
        batchJob,
        validationResult.payeeNames,
        validationResult.originalData || []
      );
      
    } catch (error) {
      logger.error('[FILE UPLOAD] Batch job creation failed:', error);
      
      toast({
        title: "Batch Job Creation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  return {
    isLoading,
    isRetrying,
    retryCount,
    submitFileForProcessing
  };
};
