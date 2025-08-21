export interface PayeeRecord {
  raw_name: string;
  norm_name: string;
}

export interface ValidationResult {
  payees: PayeeRecord[];
  payeeNames: string[]; // raw names for backward compatibility
  originalData: any[];
  payeeColumnName?: string;
  error?: Error;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: Error;
  fileType?: 'csv' | 'excel';
  size?: number;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
    rowCount?: number;
    columnCount?: number;
  };
}

export interface DataValidationResult {
  isValid: boolean;
  error?: Error;
  rowCount?: number;
  payeeCount?: number;
}

export interface AppError extends Error {
  code: string;
}
