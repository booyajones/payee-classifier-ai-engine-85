
import { useState, useCallback } from 'react';
import { AppError, handleError } from '@/lib/errorHandler';
import { logger } from '@/lib/logger';

interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError?: AppError;
}

interface UseRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  showToast?: boolean;
}

export const useRetry = <T extends any[], R>(
  asyncFunction: (...args: T) => Promise<R>,
  options: UseRetryOptions = {}
) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    showToast = true
  } = options;

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0
  });

  const executeWithRetry = useCallback(
    async (...args: T): Promise<R> => {
      const attempt = async (attemptNumber: number): Promise<R> => {
        try {
          setRetryState(prev => ({
            ...prev,
            isRetrying: attemptNumber > 0,
            retryCount: attemptNumber
          }));

          const result = await asyncFunction(...args);
          
          // Reset state on success
          setRetryState({
            isRetrying: false,
            retryCount: 0
          });

          return result;
        } catch (error) {
          const appError = handleError(error, 'Retry operation');
          
          if (attemptNumber < maxRetries) {
            logger.warn(`[RETRY] Attempt ${attemptNumber + 1} failed, retrying in ${baseDelay * Math.pow(2, attemptNumber)}ms`);
            
            // Exponential backoff
            await new Promise(resolve => 
              setTimeout(resolve, baseDelay * Math.pow(2, attemptNumber))
            );
            
            return attempt(attemptNumber + 1);
          } else {
            // Max retries reached
            setRetryState({
              isRetrying: false,
              retryCount: attemptNumber,
              lastError: appError
            });

            throw appError;
          }
        }
      };

      return attempt(0);
    },
    [asyncFunction, maxRetries, baseDelay]
  );

  const retry = useCallback((...args: T) => {
    return executeWithRetry(...args);
  }, [executeWithRetry]);

  return {
    execute: executeWithRetry,
    retry,
    ...retryState
  };
};
