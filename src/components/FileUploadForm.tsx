import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseUploadedFile } from "@/lib/fileValidation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, File, Upload, RotateCcw, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ClassificationConfig } from "@/lib/types";
import { createBatchJob, BatchJob } from "@/lib/openai/trueBatchAPI";
import { validateFile, validatePayeeData, cleanPayeeNames } from "@/lib/fileValidation";
import { handleError, showErrorToast, showRetryableErrorToast } from "@/lib/errorHandler";
import { useRetry } from "@/hooks/useRetry";

interface FileUploadFormProps {
  onBatchJobCreated: (batchJob: BatchJob, payeeNames: string[], originalFileData: any[]) => void;
  config?: ClassificationConfig;
}

const FileUploadForm = ({ 
  onBatchJobCreated,
  config = {
    aiThreshold: 80,
    bypassRuleNLP: true,
    useEnhanced: true,
    offlineMode: false,
    useFuzzyMatching: true,
    similarityThreshold: 85
  }
}: FileUploadFormProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<'none' | 'validating' | 'valid' | 'error'>('none');
  const [fileInfo, setFileInfo] = useState<{ rowCount?: number; payeeCount?: number } | null>(null);
  const [originalFileData, setOriginalFileData] = useState<any[]>([]);
  const { toast } = useToast();

  // Retry mechanism for batch job creation
  const {
    execute: createBatchJobWithRetry,
    isRetrying,
    retryCount
  } = useRetry(createBatchJob, { maxRetries: 3, baseDelay: 2000 });

  const resetForm = () => {
    setFile(null);
    setColumns([]);
    setSelectedColumn("");
    setFileError(null);
    setValidationStatus('none');
    setFileInfo(null);
    setOriginalFileData([]);
    
    // Reset the file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    
    toast({
      title: "Form Reset",
      description: "The file upload form has been reset. You can now start over.",
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setColumns([]);
    setSelectedColumn("");
    setValidationStatus('none');
    setFileInfo(null);
    setOriginalFileData([]);
    
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setValidationStatus('validating');

    try {
      // Validate file first
      const fileValidation = validateFile(selectedFile);
      if (!fileValidation.isValid) {
        setFileError(fileValidation.error!.message);
        setValidationStatus('error');
        setFile(null);
        showErrorToast(fileValidation.error!, 'File Validation');
        return;
      }

      setFile(selectedFile);
      
      // Parse headers only to get column names
      const headers = await parseUploadedFile(selectedFile, true);
      if (!headers || headers.length === 0) {
        throw new Error('No columns found in the file');
      }

      setColumns(headers);
      
      // Also parse the full file data to store for later use
      const fullData = await parseUploadedFile(selectedFile, false);
      setOriginalFileData(fullData);
      
      console.log(`[FILE UPLOAD] Stored ${fullData.length} rows of original data with ${headers.length} columns`);
      
      // Auto-select column if it contains "payee" or "name"
      const payeeColumn = headers.find(
        col => col.toLowerCase().includes('payee') || col.toLowerCase().includes('name')
      );
      
      if (payeeColumn) {
        setSelectedColumn(payeeColumn);
      }

      setValidationStatus('valid');
      
      toast({
        title: "File Uploaded Successfully",
        description: `Found ${headers.length} columns and ${fullData.length} rows. ${payeeColumn ? `Auto-selected "${payeeColumn}" column.` : 'Please select the payee name column.'}`,
      });
    } catch (error) {
      const appError = handleError(error, 'File Upload');
      console.error("Error parsing file:", error);
      setFileError(appError.message);
      setValidationStatus('error');
      setFile(null);
      showErrorToast(appError, 'File Parsing');
    }
  };

  const validateSelectedData = async () => {
    if (!file || !selectedColumn || originalFileData.length === 0) return null;

    try {
      setValidationStatus('validating');
      
      // Validate payee data using the stored original data
      const dataValidation = validatePayeeData(originalFileData, selectedColumn);
      if (!dataValidation.isValid) {
        setValidationStatus('error');
        showErrorToast(dataValidation.error!, 'Data Validation');
        return null;
      }

      // Extract and clean payee names
      const rawPayeeNames = originalFileData
        .map(row => row[selectedColumn])
        .filter(name => name && typeof name === 'string' && name.trim() !== '');
      
      const cleanedPayeeNames = cleanPayeeNames(rawPayeeNames);
      
      setFileInfo({
        rowCount: originalFileData.length,
        payeeCount: cleanedPayeeNames.length
      });

      setValidationStatus('valid');
      return cleanedPayeeNames;
    } catch (error) {
      const appError = handleError(error, 'Data Validation');
      setValidationStatus('error');
      showErrorToast(appError, 'Data Validation');
      return null;
    }
  };

  const handleProcess = async () => {
    if (!file || !selectedColumn || originalFileData.length === 0) {
      toast({
        title: "Error",
        description: "Please upload a file and select a column",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const payeeNames = await validateSelectedData();
      if (!payeeNames) {
        setIsLoading(false);
        return;
      }

      console.log(`[FILE UPLOAD] Creating batch job for ${payeeNames.length} names from column "${selectedColumn}" with ${originalFileData.length} original data rows`);

      const batchJob = await createBatchJobWithRetry(
        payeeNames, 
        `File upload batch: ${file.name}, ${payeeNames.length} payees`
      );
      
      console.log(`[FILE UPLOAD] Batch job created with original data:`, {
        jobId: batchJob.id,
        payeeCount: payeeNames.length,
        originalDataRows: originalFileData.length,
        originalDataSample: originalFileData.slice(0, 2)
      });

      // Pass both payee names AND original file data
      onBatchJobCreated(batchJob, payeeNames, originalFileData);
      
      toast({
        title: "Batch Job Created Successfully",
        description: `Submitted ${payeeNames.length} payees from ${file.name} for processing with original data preserved. Job ID: ${batchJob.id.slice(-8)}`,
      });
    } catch (error) {
      const appError = handleError(error, 'Batch Job Creation');
      console.error("Error creating batch job from file:", error);
      
      showRetryableErrorToast(
        appError, 
        () => handleProcess(),
        'Batch Job Creation'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getValidationIcon = () => {
    switch (validationStatus) {
      case 'validating':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const isProcessButtonDisabled = !file || !selectedColumn || isLoading || validationStatus === 'validating' || validationStatus === 'error' || originalFileData.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload File for Classification</CardTitle>
        <CardDescription>
          Upload an Excel or CSV file containing payee names for classification processing. All original data will be preserved in the export.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fileError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="file-upload">Upload Excel or CSV file</Label>
          <div className="flex items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={validationStatus === 'validating'}
            >
              <Upload className="h-4 w-4 mr-2" />
              {file ? 'Change File' : 'Select File'}
            </Button>
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <File className="h-4 w-4" />
                <span>{file.name}</span>
                {getValidationIcon()}
              </div>
            )}
          </div>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Accepted formats: Excel (.xlsx, .xls) or CSV files (max 50MB, 50,000 rows). All original columns will be preserved in the export.
          </p>
        </div>
        
        {columns.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="column-select">Select column with payee names</Label>
            <Select value={selectedColumn} onValueChange={setSelectedColumn}>
              <SelectTrigger id="column-select">
                <SelectValue placeholder="Select a column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fileInfo && selectedColumn && (
              <p className="text-xs text-muted-foreground">
                Found {fileInfo.rowCount} rows, {fileInfo.payeeCount} unique payee names. Original data with {columns.length} columns will be preserved.
              </p>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            type="button" 
            className="flex-1" 
            disabled={isProcessButtonDisabled}
            onClick={handleProcess}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isRetrying ? `Retrying (${retryCount + 1})...` : "Creating Job..."}
              </>
            ) : (
              "Submit File for Processing"
            )}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUploadForm;
