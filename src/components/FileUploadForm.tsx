
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useFileValidation } from "@/hooks/useFileValidation";
import { AppError } from "@/lib/fileValidation/types";
import FileUploadInput from "./file-upload/FileUploadInput";
import ColumnSelector from "./file-upload/ColumnSelector";
import FileUploadActions from "./file-upload/FileUploadActions";
import { BatchJob } from "@/lib/openai/trueBatchAPI";

interface FileUploadFormProps {
  onBatchJobCreated: (
    batchJob: BatchJob,
    payeeNames: string[],
    originalFileData: any[],
    payeeColumnName: string
  ) => void;
}

const FileUploadForm = ({ onBatchJobCreated }: FileUploadFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const {
    file,
    columns,
    selectedColumn,
    setSelectedColumn,
    validationStatus,
    fileInfo,
    originalFileData,
    fileError,
    validationResult,
    validateFile,
    reset: resetValidation
  } = useFileValidation();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      await validateFile(selectedFile);
      
      // Auto-select column if payeeColumnName was detected
      if (validationResult?.payeeColumnName) {
        setSelectedColumn(validationResult.payeeColumnName);
      }
    } catch (error) {
      console.error('File validation error:', error);
      toast({
        title: "File Validation Error",
        description: error instanceof Error ? error.message : "Failed to validate file",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!file || !validationResult || !selectedColumn) {
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
    
    try {
      console.log('[FileUploadForm] Submitting with perfect row correspondence:', {
        payeeCount: validationResult.payeeNames.length,
        originalDataCount: validationResult.originalData?.length || 0,
        selectedColumn,
        perfectAlignment: validationResult.payeeNames.length === (validationResult.originalData?.length || 0)
      });

      // Create a proper mock BatchJob with all required properties
      const mockBatchJob: BatchJob = {
        id: `batch_${Date.now()}`,
        object: 'batch',
        endpoint: '/v1/chat/completions',
        errors: null,
        input_file_id: `file_${Date.now()}`,
        completion_window: '24h',
        status: 'validating',
        output_file_id: null,
        error_file_id: null,
        created_at: Math.floor(Date.now() / 1000),
        in_progress_at: null,
        expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
        finalizing_at: null,
        completed_at: null,
        failed_at: null,
        expired_at: null,
        cancelling_at: null,
        cancelled_at: null,
        request_counts: { 
          total: validationResult.payeeNames.length, 
          completed: 0, 
          failed: 0 
        }
      };

      await onBatchJobCreated(
        mockBatchJob,
        validationResult.payeeNames,
        validationResult.originalData || [],
        selectedColumn
      );
    } catch (error) {
      console.error('Submit error:', error);
      const appError: AppError = {
        ...error as Error,
        code: 'SUBMIT_ERROR'
      };
      toast({
        title: "Submission Error",
        description: appError.message || "Failed to submit file for processing",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    resetValidation();
    
    // Clear the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const isProcessButtonDisabled = 
    !file || 
    validationStatus === 'validating' || 
    validationStatus === 'error' || 
    !selectedColumn || 
    !validationResult?.payeeNames?.length ||
    isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload File for Batch Processing</CardTitle>
        <CardDescription>
          Upload an Excel or CSV file containing payee names for AI-powered classification with perfect data alignment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileUploadInput
          file={file}
          validationStatus={validationStatus}
          onFileChange={handleFileChange}
        />

        {validationStatus === 'error' && fileError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-medium">Validation Error</p>
            <p className="text-sm text-destructive/80 mt-1">
              {fileError}
            </p>
          </div>
        )}

        <ColumnSelector
          columns={columns}
          selectedColumn={selectedColumn}
          onColumnChange={setSelectedColumn}
          fileInfo={fileInfo}
        />

        <FileUploadActions
          isLoading={isLoading}
          isRetrying={isRetrying}
          retryCount={retryCount}
          isProcessButtonDisabled={isProcessButtonDisabled}
          onProcess={handleSubmit}
          onReset={handleReset}
        />
      </CardContent>
    </Card>
  );
};

export default FileUploadForm;
