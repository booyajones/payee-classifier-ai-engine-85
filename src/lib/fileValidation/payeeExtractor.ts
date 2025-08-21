import { ValidationResult } from './types';
import { logger } from '@/lib/logger';

export const validateFileContents = (data: any[]): ValidationResult => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('File appears to be empty or invalid');
  }

  // Remove header row if it exists (detect by checking if first row has likely header values)
  const hasHeader = data.length > 1 && 
    Object.values(data[0]).some(value => 
      typeof value === 'string' && 
      /^(name|payee|vendor|company|client|customer)/i.test(value as string)
    );
  
  const dataRows = hasHeader ? data.slice(1) : data;
  const originalData = [...dataRows]; // Preserve complete original data
  
  if (dataRows.length === 0) {
    throw new Error('No data rows found in the file');
  }

  // Find the payee column name
  let payeeColumnName = '';
  if (dataRows.length > 0) {
    const firstRow = dataRows[0];
    const keys = Object.keys(firstRow);
    
    // Look for common payee name column names
    const nameKeys = keys.filter(key => 
      /^(name|payee|vendor|company|client|customer|recipient|supplier)/i.test(key)
    );
    
    if (nameKeys.length > 0) {
      payeeColumnName = nameKeys[0];
    } else {
      // Fallback to first column
      payeeColumnName = keys[0];
    }
  }

  if (!payeeColumnName) {
    throw new Error('No valid payee column found in the file.');
  }

  // Extract payee names WITHOUT filtering or cleaning - maintain exact 1:1 correspondence
  const payeeNames: string[] = [];
  
  for (const row of dataRows) {
    const payeeName = String(row[payeeColumnName] || '').trim();
    // Keep ALL rows, even empty ones - this maintains index correspondence
    payeeNames.push(payeeName || '[Empty]');
  }

  logger.info(`[FILE VALIDATION] Extracted ${payeeNames.length} payee names (including empty) and preserved ${originalData.length} original data rows with exact 1:1 correspondence`);
  
  return {
    payeeNames,
    originalData,
    payeeColumnName // Include the column name for validation
  };
};

export const cleanPayeeNames = (payeeNames: string[]): string[] => {
  // Don't actually clean - just return as-is to maintain correspondence
  // Any cleaning will break the index alignment
  return payeeNames;
};
