
import { useState } from "react";
import { parseUploadedFile } from "@/lib/fileValidation";
import { validateFile, validatePayeeData } from "@/lib/fileValidation";
import { ValidationResult, PayeeRecord } from "@/lib/fileValidation/types";
import { OriginalRow } from "@/lib/types";
import { handleError, showErrorToast } from "@/lib/errorHandler";
import { useToast } from "@/components/ui/use-toast";

export const useFileValidation = () => {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [validationStatus, setValidationStatus] = useState<'none' | 'validating' | 'valid' | 'error'>('none');
  const [fileInfo, setFileInfo] = useState<{ rowCount?: number; payeeCount?: number } | null>(null);
  const [originalFileData, setOriginalFileData] = useState<OriginalRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const { toast } = useToast();

  const COMPANY_SUFFIXES = [
    'inc', 'inc.', 'llc', 'l.l.c.', 'corp', 'corporation', 'company', 'co', 'co.', 'ltd', 'limited',
    'plc', 'gmbh', 's.a.', 's.a', 's.l.', 's.l', 's.a.s', 'ltda'
  ];

  const normalizeName = (name: string): string => {
    let norm = name.toLowerCase().normalize('NFKC');
    norm = norm.replace(/[^\p{L}\p{N} ]+/gu, '');
    const suffixRegex = new RegExp(`\\b(${COMPANY_SUFFIXES.join('|')})\\b`, 'gi');
    norm = norm.replace(suffixRegex, '');
    return norm.replace(/\s+/g, ' ').trim();
  };

  const resetValidation = () => {
    setFile(null);
    setColumns([]);
    setSelectedColumn("");
    setFileError(null);
    setValidationStatus('none');
    setFileInfo(null);
    setOriginalFileData([]);
    setValidationResult(null);
  };

  const validateFileUpload = async (selectedFile: File) => {
    setFileError(null);
    setColumns([]);
    setSelectedColumn("");
    setValidationStatus('none');
    setFileInfo(null);
    setOriginalFileData([]);
    setValidationResult(null);
    
    setValidationStatus('validating');

    try {
      // Validate file first
      const fileValidation = validateFile(selectedFile);
      if (!fileValidation.isValid) {
        const appError = handleError(fileValidation.error!, 'File Validation');
        setFileError(appError.message);
        setValidationStatus('error');
        setFile(null);
        showErrorToast(appError, 'File Validation');
        return { success: false };
      }

      setFile(selectedFile);

      const { headers, rows } = await parseUploadedFile(selectedFile);
      if (!headers || headers.length === 0) {
        throw new Error('No columns found in the file');
      }

      setColumns(headers);

      const payeeColumn = headers.find(
        col => col.toLowerCase().includes('payee') || col.toLowerCase().includes('name')
      );

      if (payeeColumn) {
        setSelectedColumn(payeeColumn);
      }

      const fullData: OriginalRow[] = [];
      const payees: PayeeRecord[] = [];
      for await (const row of rows) {
        fullData.push(row);
        const raw = String(row[payeeColumn || headers[0]] || '').trim() || '[Empty]';
        const norm = normalizeName(raw);
        payees.push({ raw_name: raw, norm_name: norm });
      }

      setOriginalFileData(fullData);

      console.log(`[FILE VALIDATION] Stored ${fullData.length} rows of original data with ${headers.length} columns`);

      const result: ValidationResult = {
        payees,
        payeeNames: payees.map(p => p.raw_name),
        originalData: fullData,
        payeeColumnName: payeeColumn
      };
      setValidationResult(result);

      setFileInfo({ rowCount: fullData.length, payeeCount: payees.length });

      setValidationStatus('valid');

      toast({
        title: "File Uploaded Successfully",
        description: `Found ${headers.length} columns and ${fullData.length} rows. ${payeeColumn ? `Auto-selected "${payeeColumn}" column.` : 'Please select the payee name column.'}`,
      });

      return { success: true, headers, fullData };
    } catch (error) {
      const appError = handleError(error, 'File Upload');
      console.error("Error parsing file:", error);
      setFileError(appError.message);
      setValidationStatus('error');
      setFile(null);
      showErrorToast(appError, 'File Parsing');
      return { success: false };
    }
  };

  const validateSelectedData = async () => {
    if (!file || !selectedColumn || originalFileData.length === 0) return null;

    try {
      setValidationStatus('validating');
      
      // Validate payee data using the stored original data
      const dataValidation = validatePayeeData(originalFileData, selectedColumn);
      if (!dataValidation.isValid) {
        const appError = handleError(dataValidation.error!, 'Data Validation');
        setValidationStatus('error');
        showErrorToast(appError, 'Data Validation');
        return null;
      }

      const payees: PayeeRecord[] = originalFileData.map(row => {
        const raw = String(row[selectedColumn] || '').trim() || '[Empty]';
        const norm = normalizeName(raw);
        return { raw_name: raw, norm_name: norm };
      });

      console.log(`[FILE VALIDATION] Maintaining exact 1:1 correspondence: ${originalFileData.length} rows = ${payees.length} payees`);

      const result: ValidationResult = {
        payees,
        payeeNames: payees.map(p => p.raw_name),
        originalData: originalFileData,
        payeeColumnName: selectedColumn
      };
      setValidationResult(result);

      setFileInfo({
        rowCount: originalFileData.length,
        payeeCount: payees.length
      });

      setValidationStatus('valid');
      return payeeNames;
    } catch (error) {
      const appError = handleError(error, 'Data Validation');
      setValidationStatus('error');
      showErrorToast(appError, 'Data Validation');
      return null;
    }
  };

  return {
    file,
    columns,
    selectedColumn,
    setSelectedColumn,
    validationStatus,
    fileInfo,
    originalFileData,
    fileError,
    validationResult,
    resetValidation,
    validateFileUpload,
    validateSelectedData,
    // Aliases for compatibility
    validateFile: validateFileUpload,
    reset: resetValidation
  };
};
