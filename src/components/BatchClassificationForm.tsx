import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle } from "lucide-react";
import BatchJobManager from "./BatchJobManager";
import BatchResultsDisplay from "./BatchResultsDisplay";
import FileUploadForm from "./FileUploadForm";
import APIKeyInput from "./APIKeyInput";
import { PayeeClassification, BatchProcessingResult } from "@/lib/types";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { isOpenAIInitialized, testOpenAIConnection } from "@/lib/openai/client";
import { enhancedCleanProcessBatch } from "@/lib/classification/enhancedCleanBatchProcessor";
import { exportResultsFixed } from "@/lib/classification/fixedExporter";
import { useBatchJobs } from "@/hooks/useBatchJobs";
import { useProcessing } from "@/contexts/ProcessingContext";
import { saveProcessingResults } from "@/lib/storage/resultStorage";
import { storageService } from "@/services/storageService";
import { logger } from "@/lib/logger";

interface BatchClassificationFormProps {
  onComplete: (results: PayeeClassification[], summary: BatchProcessingResult) => void;
  onApiKeySet?: () => void;
  onApiKeyChange?: () => void;
}

const BatchClassificationForm = ({ onComplete, onApiKeySet, onApiKeyChange }: BatchClassificationFormProps) => {
  const [batchResults, setBatchResults] = useState<PayeeClassification[]>([]);
  const [processingSummary, setProcessingSummary] = useState<BatchProcessingResult | null>(null);
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { addJob, updateJob, removeJob } = useProcessing();
  const { addJob: addPersistentJob } = useBatchJobs();

  useEffect(() => {
    const checkApiKey = async () => {
      setIsCheckingApiKey(true);
      
      try {
        if (isOpenAIInitialized()) {
          const isWorking = await testOpenAIConnection();
          setIsApiKeyValid(isWorking);
          
          if (!isWorking) {
            toast({
              title: "API Key Issue",
              description: "OpenAI API key test failed. Please check your API key.",
              variant: "destructive"
            });
          }
        } else {
          setIsApiKeyValid(false);
        }
      } catch (error) {
        setIsApiKeyValid(false);
        toast({
          title: "API Connection Error",
          description: "Failed to verify OpenAI API connection.",
          variant: "destructive"
        });
      } finally {
        setIsCheckingApiKey(false);
      }
    };

    checkApiKey();
  }, [toast]);

  const handleDirectProcessing = async (originalFileData: any[], selectedColumn: string) => {
    setIsProcessing(true);
    
    const jobId = `direct-${Date.now()}`;
    
    addJob({
      id: jobId,
      type: 'direct',
      startTime: Date.now(),
      totalRows: originalFileData.length,
      processedRows: 0,
      excludedCount: 0,
      aiProcessedCount: 0,
      errorCount: 0,
      status: 'running'
    });
    
    try {
      const result = await enhancedCleanProcessBatch(
        originalFileData, 
        selectedColumn, 
        {
          aiThreshold: 75,
          bypassRuleNLP: false,
          useEnhanced: true,
          offlineMode: false
        },
        (current, total, stats) => {
          updateJob(jobId, {
            processedRows: current,
            excludedCount: stats.excludedCount,
            aiProcessedCount: stats.aiProcessedCount,
            errorCount: stats.errorCount,
            processingSpeed: stats.processingSpeed,
            estimatedTimeRemaining: stats.estimatedTimeRemaining
          });
        }
      );
      
      updateJob(jobId, {
        status: 'completed',
        processedRows: originalFileData.length
      });
      
      try {
        const { saveProcessingResults, isSupabaseConfigured } = await import('@/lib/storage/resultStorage');
        if (isSupabaseConfigured()) {
          await saveProcessingResults(result.results, result, jobId, 'direct');
        }
      } catch (dbError) {
        console.error('[BATCH FORM] Failed to save results to database:', dbError);
        if (!dbError?.message?.includes('Database not configured')) {
          toast({
            title: "Warning",
            description: "Processing completed but failed to save to database. Results are still available for export.",
            variant: "destructive"
          });
        }
      }
      
      setTimeout(() => removeJob(jobId), 5000);
      
      setBatchResults(result.results);
      setProcessingSummary(result);
      onComplete(result.results, result);
      
      storageService.cleanup();
      
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${result.results.length} payees.`,
      });
      
    } catch (error) {
      updateJob(jobId, { status: 'failed' });
      setTimeout(() => removeJob(jobId), 3000);
      
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchJobCreated = async (batchJob: BatchJob, payeeNames: string[], originalFileData: any[] = []) => {
    logger.info(`[BATCH FORM] Handling batch job creation: ${batchJob.id}`);
    
    if (!isApiKeyValid) {
      const error = "Please set a valid OpenAI API key before creating batch jobs.";
      logger.error(`[BATCH FORM] ${error}`);
      toast({
        title: "API Key Required",
        description: error,
        variant: "destructive"
      });
      return;
    }
    
    try {
      logger.info(`[BATCH FORM] Adding job to persistent storage...`);
      await addPersistentJob(batchJob, payeeNames, originalFileData);
      logger.info(`[BATCH FORM] Job added successfully, running storage cleanup`);
      
      storageService.cleanup();
      
      toast({
        title: "Batch Job Created Successfully",
        description: `Created batch job ${batchJob.id.slice(-8)} with ${payeeNames.length} payees. Monitor progress below.`,
      });
      
      logger.info(`[BATCH FORM] Batch job creation completed successfully`);
    } catch (error) {
      logger.error('[BATCH FORM] Error adding batch job:', error);
      toast({
        title: "Failed to Save Batch Job",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleJobComplete = async (results: PayeeClassification[], summary: BatchProcessingResult, jobId: string) => {
    logger.info(`[BATCH FORM] Job completed: ${jobId}, results: ${results.length}`);
    setBatchResults(results);
    setProcessingSummary(summary);
    onComplete(results, summary);
    
    try {
      const { saveProcessingResults, isSupabaseConfigured } = await import('@/lib/storage/resultStorage');
      if (isSupabaseConfigured()) {
        await saveProcessingResults(results, summary, jobId, 'batch');
      }
    } catch (dbError) {
      logger.error('[BATCH FORM] Failed to save batch results to database:', dbError);
      if (!dbError?.message?.includes('Database not configured')) {
        toast({
          title: "Warning",
          description: "Batch processing completed but failed to save to database. Results are still available for export.",
          variant: "destructive"
        });
      }
    }
    
    storageService.cleanup();
    
    toast({
      title: "Results Downloaded",
      description: `Successfully downloaded ${results.length} results.`,
    });
  };

  const handleReset = () => {
    setBatchResults([]);
    setProcessingSummary(null);
  };

  const handleApiKeySetLocal = () => {
    setIsApiKeyValid(true);
    onApiKeySet?.();
  };

  const handleApiKeyChangeLocal = () => {
    setIsApiKeyValid(isOpenAIInitialized());
    onApiKeyChange?.();
  };

  if (isCheckingApiKey) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Verifying API connection...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isApiKeyValid) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <APIKeyInput 
              onApiKeySet={handleApiKeySetLocal}
              onApiKeyChange={handleApiKeyChangeLocal} 
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FileUploadForm 
        onBatchJobCreated={handleBatchJobCreated}
        onDirectProcessing={handleDirectProcessing}
        isProcessing={isProcessing}
      />

      <BatchJobManager onJobComplete={handleJobComplete} />

      <BatchResultsDisplay
        batchResults={batchResults}
        processingSummary={processingSummary}
        onReset={handleReset}
        isProcessing={isProcessing}
        exportFunction={exportResultsFixed}
      />
    </div>
  );
};

export default BatchClassificationForm;
