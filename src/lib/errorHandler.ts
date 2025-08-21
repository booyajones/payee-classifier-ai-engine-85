import { toast } from "@/hooks/use-toast";
import { logger } from '@/lib/logger';

export interface AppError {
  code: string;
  message: string;
  details?: string;
  retryable?: boolean;
}

export class BatchProcessingError extends Error implements AppError {
  code: string;
  details?: string;
  retryable: boolean;

  constructor(code: string, message: string, details?: string, retryable = false) {
    super(message);
    this.name = 'BatchProcessingError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export class FileValidationError extends Error implements AppError {
  code: string;
  details?: string;
  retryable: boolean;

  constructor(code: string, message: string, details?: string, retryable = false) {
    super(message);
    this.name = 'FileValidationError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export const ERROR_CODES = {
  BATCH_CREATION_FAILED: 'BATCH_CREATION_FAILED',
  API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  UPSTREAM_5XX: 'UPSTREAM_5XX',
  TIMEOUT: 'TIMEOUT',
  BATCH_ABORTED: 'BATCH_ABORTED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  EMPTY_FILE: 'EMPTY_FILE',
  NO_VALID_PAYEES: 'NO_VALID_PAYEES',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  JOB_EXPIRED: 'JOB_EXPIRED',
  PARSING_ERROR: 'PARSING_ERROR'
} as const;

export const RETRY_INSTRUCTIONS: Record<string, string> = {
  [ERROR_CODES.RATE_LIMIT]: 'Please wait before retrying.',
  [ERROR_CODES.API_QUOTA_EXCEEDED]: 'Please check your plan and billing details.',
  [ERROR_CODES.NETWORK_ERROR]: 'Check your connection and try again.',
  [ERROR_CODES.INVALID_JSON]: 'The response was malformed. Please retry.',
  [ERROR_CODES.UPSTREAM_5XX]: 'Upstream service error. Try again shortly.',
  [ERROR_CODES.TIMEOUT]: 'The request timed out. Please retry.',
  [ERROR_CODES.BATCH_ABORTED]: 'The batch was aborted. Please resubmit.',
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: 'Local storage is full. Please clear some data and try again.',
};

export const handleError = (error: unknown, context?: string): AppError => {
  logger.error(`[ERROR HANDLER] ${context || 'Unknown context'}:`, error);

  if (error instanceof BatchProcessingError || error instanceof FileValidationError) {
    return error;
  }

  if (error instanceof Error) {
    // Handle specific error patterns
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return new BatchProcessingError(
        ERROR_CODES.RATE_LIMIT,
        'Rate limit exceeded.',
        error.message,
        true
      );
    }

    if (message.includes('quota')) {
      return new BatchProcessingError(
        ERROR_CODES.API_QUOTA_EXCEEDED,
        'API quota exceeded.',
        error.message,
        true
      );
    }

    if (message.includes('invalid json') || message.includes('unexpected token') || message.includes('json parse')) {
      return new BatchProcessingError(
        ERROR_CODES.INVALID_JSON,
        'Invalid JSON response received.',
        error.message,
        true
      );
    }

    if (/(5\d{2}|internal server error|bad gateway|service unavailable)/.test(message)) {
      return new BatchProcessingError(
        ERROR_CODES.UPSTREAM_5XX,
        'Upstream service returned an error.',
        error.message,
        true
      );
    }

    if (message.includes('timeout') || message.includes('timed out') || message.includes('aborterror') || message.includes('etimedout')) {
      return new BatchProcessingError(
        ERROR_CODES.TIMEOUT,
        'Request timed out.',
        error.message,
        true
      );
    }

    if (message.includes('batch aborted') || message.includes('batch was aborted') || message.includes('batch cancelled')) {
      return new BatchProcessingError(
        ERROR_CODES.BATCH_ABORTED,
        'Batch processing was aborted.',
        error.message,
        false
      );
    }

    if (message.includes('network') || message.includes('fetch')) {
      return new BatchProcessingError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error occurred.',
        error.message,
        true
      );
    }

    if (message.includes('quotaexceedederror') || message.includes('storage quota')) {
      return new BatchProcessingError(
        ERROR_CODES.STORAGE_QUOTA_EXCEEDED,
        'Local storage is full.',
        error.message,
        false
      );
    }

    // Generic error
    return new BatchProcessingError(
      'UNKNOWN_ERROR',
      error.message || 'An unexpected error occurred.',
      error.stack,
      false
    );
  }

  // Fallback for non-Error objects
  return new BatchProcessingError(
    'UNKNOWN_ERROR',
    'An unexpected error occurred.',
    String(error),
    false
  );
};

export const showErrorToast = (error: AppError, context?: string) => {
  const title = context ? `${context} Error` : 'Error';

  const instruction = RETRY_INSTRUCTIONS[error.code];

  toast({
    title,
    description: `${error.message}${instruction ? ` ${instruction}` : ''} (Code: ${error.code})`,
    variant: "destructive",
  });

  // Log detailed error for debugging
  logger.error(`[${error.code}] ${error.message}`, error.details);
};

export const showRetryableErrorToast = (
  error: AppError,
  onRetry: () => void,
  context?: string
) => {
  if (error.retryable) {
    const instruction = RETRY_INSTRUCTIONS[error.code];

    toast({
      title: `${context || 'Operation'} Failed`,
      description: `${error.message}${instruction ? ` ${instruction}` : ''} (Code: ${error.code})`,
      variant: "destructive",
    });

    // For now, we'll just show the error without the retry button
    // The user can manually retry through the UI
    logger.warn('[RETRY] Retryable error occurred:', error);
  } else {
    showErrorToast(error, context);
  }
};
