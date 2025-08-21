
import { FileValidationError, ERROR_CODES } from '../errorHandler';
import { FileValidationResult } from './types';
import { MAX_FILE_SIZE, SUPPORTED_EXTENSIONS, VALID_MIME_TYPES } from './constants';
import { logger } from '@/lib/logger';

export const validateFile = (file: File): FileValidationResult => {
  logger.info(`[FILE VALIDATION] Validating file: ${file.name}, size: ${file.size} bytes`);

  // Check file size
  if (file.size === 0) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.EMPTY_FILE,
        'The selected file is empty. Please choose a file with data.',
        `File size: ${file.size} bytes`
      )
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.FILE_TOO_LARGE,
        `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        `File size: ${file.size} bytes, limit: ${MAX_FILE_SIZE} bytes`
      )
    };
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      error: new FileValidationError(
        ERROR_CODES.INVALID_FILE_FORMAT,
        `Unsupported file format. Please upload ${SUPPORTED_EXTENSIONS.join(', ')} files only.`,
        `File extension: ${extension}`
      )
    };
  }

  // Check MIME type for additional validation
  if (file.type && !VALID_MIME_TYPES.includes(file.type)) {
    logger.warn(`[FILE VALIDATION] Unexpected MIME type: ${file.type}, but extension is valid`);
  }

  return {
    isValid: true,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type || 'unknown'
    }
  };
};
