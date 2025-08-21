import { logger } from "../logger";


interface RequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  isStatusCheck?: boolean;
}

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isTimeout: boolean = false,
    public isRateLimit: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Enhanced API request wrapper with timeout, retries, rate limit handling, and error handling
 */
export async function makeAPIRequest<T>(
  requestFn: (signal: AbortSignal) => Promise<T>,
  config: RequestConfig = {}
): Promise<T> {
  const {
    timeout = config.isStatusCheck ? 30000 : 20000, // Longer timeout for status checks
    retries = 3,
    retryDelay = 1000,
    isStatusCheck = false
  } = config;

  let lastError: Error;
  let consecutiveRateLimits = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let controller: AbortController;
    let timeoutId: ReturnType<typeof setTimeout>;

    try {
      logger.info(`[API] Attempt ${attempt + 1}/${retries + 1}${isStatusCheck ? ' (status check)' : ''}`);

      // Apply rate limit backoff
      if (consecutiveRateLimits > 0) {
        const rateLimitDelay = Math.min(5000 * Math.pow(2, consecutiveRateLimits - 1), 60000);
        logger.info(`[API] Rate limit backoff: waiting ${rateLimitDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
      }

      controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const result = await requestFn(controller.signal);

      clearTimeout(timeoutId);

      if (attempt > 0) {
        logger.info(`[API] Request succeeded after ${attempt + 1} attempts`);
      }

      return result;
    } catch (error) {
      const err = error as Error;
      lastError = err;

      clearTimeout(timeoutId);

      // If the controller was aborted, treat as timeout
      const isTimeout = controller.signal.aborted || err.name === 'AbortError' || err.message.includes('timed out');

      // Check for specific error types
      const errorMessage = err.message.toLowerCase();
      const isRateLimit = errorMessage.includes('429') ||
                         errorMessage.includes('rate limit') ||
                         errorMessage.includes('quota exceeded');

      if (isTimeout) {
        controller.abort();
        logger.error(`[API] Request timed out after ${timeout}ms (attempt ${attempt + 1})`);
        lastError = new APIError(`Request timed out after ${timeout}ms`, undefined, true, false);
      } else if (isRateLimit) {
        consecutiveRateLimits++;
        logger.error(`[API] Rate limit hit (attempt ${attempt + 1}, consecutive: ${consecutiveRateLimits})`);
        lastError = new APIError('Rate limit exceeded', 429, false, true);
      } else {
        logger.error(`[API] Request failed on attempt ${attempt + 1}:`, error);
        consecutiveRateLimits = 0; // Reset rate limit counter for non-rate-limit errors
      }

      // Don't retry on the last attempt
      if (attempt < retries) {
        let delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
        
        // Additional delay for rate limits
        if (isRateLimit) {
          delay = Math.max(delay, 10000); // Minimum 10s for rate limits
        }
        
        // Add jitter
        delay = delay * (0.8 + Math.random() * 0.4);
        
        logger.info(`[API] Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if the server is healthy
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    // Simple health check - try to make a minimal API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/api/health', {
      signal: controller.signal,
      method: 'HEAD'
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    logger.error('[API] Server health check failed:', error);
    return false;
  }
}

/**
 * Memory usage monitor
 */
export function getMemoryUsage(): { used: number; limit: number; percentage: number } {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }
  
  return { used: 0, limit: 0, percentage: 0 };
}

/**
 * Log memory usage with warnings
 */
export function logMemoryUsage(context: string): void {
  const memory = getMemoryUsage();
  
  if (memory.percentage > 80) {
    logger.warn(`[MEMORY] High memory usage in ${context}: ${memory.percentage.toFixed(1)}%`);
  } else if (memory.percentage > 0) {
    logger.info(`[MEMORY] Memory usage in ${context}: ${memory.percentage.toFixed(1)}%`);
  }
}
