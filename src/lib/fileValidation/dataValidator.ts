
import { FileValidationError, ERROR_CODES } from '../errorHandler';
import { FileValidationResult } from './types';
import { MAX_ROWS } from './constants';
import { cleanPayeeNames } from './payeeExtractor';
import { logger } from '@/lib/logger';

export const validatePayeeData = (data: any[], selectedColumn: string): FileValidationResult => {
  logger.info(`[PAYEE VALIDATION] Validating ${data.length} rows for column: ${selectedColumn}`);

  if (!data || data.length === 0) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.EMPTY_FILE,
        'The file appears to be empty or has no data rows.',
        `Rows found: ${data.length}`
      )
    };
  }

  if (data.length > MAX_ROWS) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.FILE_TOO_LARGE,
        `Too many rows (${data.length}). Maximum allowed is ${MAX_ROWS} payee names.`,
        `Rows: ${data.length}, limit: ${MAX_ROWS}`
      )
    };
  }

  // Extract and validate payee names
  const payeeNames = data
    .map(row => {
      const value = row[selectedColumn];
      return typeof value === 'string' ? value.trim() : String(value || '').trim();
    })
    .filter(name => name.length > 0);

  if (payeeNames.length === 0) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.NO_VALID_PAYEES,
        `No valid payee names found in the "${selectedColumn}" column. Please check your data and column selection.`,
        `Total rows: ${data.length}, valid payees: ${payeeNames.length}`
      )
    };
  }

  // Check for reasonable minimum
  if (payeeNames.length < 1) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.NO_VALID_PAYEES,
        'At least one valid payee name is required for processing.',
        `Valid payees found: ${payeeNames.length}`
      )
    };
  }

  // Remove duplicates and count
  const uniquePayees = [...new Set(payeeNames)];
  const duplicateCount = payeeNames.length - uniquePayees.length;

  logger.info(`[PAYEE VALIDATION] Found ${payeeNames.length} total payees, ${uniquePayees.length} unique, ${duplicateCount} duplicates`);

  return {
    isValid: true,
    fileInfo: {
      name: 'payee-data',
      size: data.length,
      type: 'payee-list',
      rowCount: data.length,
      columnCount: Object.keys(data[0] || {}).length
    }
  };
};
