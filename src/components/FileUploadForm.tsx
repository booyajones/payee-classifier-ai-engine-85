
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useFileValidation } from "@/hooks/useFileValidation";
import { useFileUpload } from "@/hooks/useFileUpload";
import FileUploadHeader from "./file-upload/FileUploadHeader";
import FileUploadInput from "./file-upload/FileUploadInput";
import ValidationErrorDisplay from "./file-upload/ValidationErrorDisplay";
import ColumnSelector from "./file-upload/ColumnSelector";
import FileUploadActions from "./file-upload/FileUploadActions";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { useToast } from "@/components/ui/use-toast";

interface FileUploadFormProps {
  onBatchJobCreated: (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => void;
  isProcessing?: boolean;
}

const FileUploadForm = ({ onBatchJobCreated, isProcessing = false }: FileUploadFormProps) => {
  const { toast } = useToast();

  const {
    file,
    columns,
    selectedColumn,
    setSelectedColumn,
    validationStatus,
    fileInfo,
    fileError,
    validationResult,
    validateFile,
    reset: resetValidation
  } = useFileValidation();

  const {
    isLoading: uploadIsLoading,
    isRetrying,
    retryCount,
    submitFileForProcessing
  } = useFileUpload({ onBatchJobCreated });

  const actualIsLoading = uploadIsLoading || isProcessing;

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
    if (!validationResult || !selectedColumn) {
      toast({
        title: "Validation Error",
        description: "Please select a valid column to process",
        variant: "destructive",
      });
      return;
    }

    // Always use batch processing - extract names for batch API
    const payeeNames: string[] = [];
    for (const row of validationResult.originalData) {
      const payeeName = String(row[selectedColumn] || '').trim();
      payeeNames.push(payeeName || '[Empty]');
    }
    console.log(`[FILE UPLOAD] Starting batch job creation with column: ${selectedColumn}`);
    await submitFileForProcessing({ ...validationResult, payeeNames }, selectedColumn);
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
    !validationResult?.originalData?.length ||
    actualIsLoading;

  const getProcessButtonText = () => {
    if (actualIsLoading) {
      return isRetrying ? `Retrying (${retryCount + 1})...` : "Creating Batch Job...";
    }
    
    return "Create Batch Job";
  };

  return (
    <Card>
      <FileUploadHeader />
      <CardContent className="space-y-4">
        <FileUploadInput
          file={file}
          validationStatus={validationStatus}
          onFileChange={handleFileChange}
        />

        <ValidationErrorDisplay fileError={fileError} />

        <ColumnSelector
          columns={columns}
          selectedColumn={selectedColumn}
          onColumnChange={setSelectedColumn}
          fileInfo={fileInfo}
        />

        <FileUploadActions
          isLoading={actualIsLoading}
          isRetrying={isRetrying}
          retryCount={retryCount}
          isProcessButtonDisabled={isProcessButtonDisabled}
          onProcess={handleSubmit}
          onReset={handleReset}
          buttonText={getProcessButtonText()}
        />
      </CardContent>
    </Card>
  );
};

export default FileUploadForm;
