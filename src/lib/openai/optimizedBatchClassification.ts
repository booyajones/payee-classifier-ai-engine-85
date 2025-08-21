import { getOpenAIClient } from './client';
import { timeoutPromise } from './utils';
import {
  DEFAULT_API_TIMEOUT,
  CLASSIFICATION_MODEL,
  MAX_PARALLEL_BATCHES,
  MAX_TOKENS
} from './config';
import { logger } from '../logger';
import { classificationResponseSchema } from './schema';

export const MAX_RETRIES = 2;
export const RETRY_DELAY_BASE = 1000;


interface BatchItem {
  original: string;
  processed: string;
  tokens: number;
}

function estimateTokens(text: string): number {
  return Math.ceil((text?.length || 0) / 4);
}

function preprocessPayeeDescription(name: string, maxTokens: number): string {
  const tokens = estimateTokens(name);
  if (tokens <= maxTokens) {
    return name;
  }
  const maxChars = maxTokens * 4;
  return name.slice(0, maxChars) + '…';
}

interface CachedResult {
  classification: 'Business' | 'Individual';
  confidence: number;
  reasoning: string;
  timestamp: number;
}

// In-memory cache for session-based deduplication
const classificationCache = new Map<string, CachedResult>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 1000;

// Key used for persistent cache storage
const LOCAL_STORAGE_KEY = 'optimized_classification_cache';

// Whether to persist cache to localStorage
let persistCache = true;

let cacheHits = 0;
let cacheLookups = 0;

const PROMPT_VERSION = 'v1';

/**
 * Load cache from localStorage on initialization
 */
function loadCacheFromStorage(): void {
  if (!persistCache || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const stored = JSON.parse(raw) as Record<string, CachedResult>;
    const now = Date.now();
    const cleaned: Record<string, CachedResult> = {};

    Object.entries(stored).forEach(([key, entry]) => {
      if (now - entry.timestamp < CACHE_TTL) {
        classificationCache.set(key, entry);
        cleaned[key] = entry;
      }
    });

    const entries = Object.entries(cleaned);
    if (entries.length > MAX_CACHE_SIZE) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.splice(0, entries.length - MAX_CACHE_SIZE);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    logger.info(`[CACHE] Loaded ${classificationCache.size} cached results from storage`);
  } catch (error) {
    logger.warn('[CACHE] Failed to load cache from storage:', error);
  }
}

/**
 * Save current cache to localStorage
 */
function saveCacheToStorage(): void {
  if (!persistCache || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const entries: [string, CachedResult][] = [];
    const now = Date.now();
    for (const [key, value] of classificationCache.entries()) {
      if (now - value.timestamp < CACHE_TTL) {
        entries.push([key, value]);
      }
    }

    if (entries.length > MAX_CACHE_SIZE) {
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.splice(0, entries.length - MAX_CACHE_SIZE);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    logger.warn('[CACHE] Failed to save cache to storage:', error);
  }
}

// Load cache immediately when module initializes
loadCacheFromStorage();

// Save cache before the page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', saveCacheToStorage);
}

/**
 * Generate cache key using normalized name and prompt version
 */
function getCacheKey(name: string): string {
  if (!name || typeof name !== 'string') {
    logger.warn('[CACHE] Invalid name for caching:', name);
    return '';
  }
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalized}|${PROMPT_VERSION}`;
}

/**
 * Check if cached result is still valid
 */
function isCacheValid(result: CachedResult): boolean {
  if (!result || typeof result.timestamp !== 'number') {
    return false;
  }
  return Date.now() - result.timestamp < CACHE_TTL;
}

/**
 * Get cached result if available and valid
 */
function getCachedResult(name: string): CachedResult | null {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const key = getCacheKey(name);
  if (!key) {
    return null;
  }

  cacheLookups++;
  const cached = classificationCache.get(key);

  if (cached && isCacheValid(cached)) {
    cacheHits++;
    logger.info(`[CACHE] Using cached result for "${name}"`);
    return cached;
  }

  if (cached) {
    classificationCache.delete(key);
  }

  return null;
}

/**
 * Cache a classification result
 */
function setCachedResult(name: string, result: CachedResult): void {
  if (!name || typeof name !== 'string' || !result) {
    logger.warn('[CACHE] Invalid data for caching:', { name, result });
    return;
  }

  const key = getCacheKey(name);
  if (!key) {
    return;
  }

  if (classificationCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = classificationCache.keys().next().value;
    if (oldestKey) {
      classificationCache.delete(oldestKey);
    }
  }

  classificationCache.set(key, {
    ...result,
    timestamp: Date.now()
  });
}

/**
 * Retry function with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY_BASE
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof Error && 
          (error.message.includes('401') || error.message.includes('authentication'))) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      logger.info(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Create fallback result for failed classifications
 */
function createFallbackResult(payeeName: string, error?: string): {
  payeeName: string;
  classification: 'Business' | 'Individual';
  confidence: number;
  reasoning: string;
  source: 'api';
} {
  return {
    payeeName,
    classification: 'Individual',
    confidence: 0,
    reasoning: error ? `Classification failed: ${error}` : 'Classification failed - using fallback',
    source: 'api'
  };
}

/**
 * Validate and sanitize API response
 */
function validateApiResponse(content: string, expectedCount: number): any[] {
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid API response: empty or non-string content');
  }

  logger.info(`[VALIDATION] Raw API response:`, content);

  const cleanContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanContent);
  } catch (parseError) {
    logger.error(`[VALIDATION] JSON parse error:`, parseError);
    throw new Error(`Failed to parse API response as JSON: ${parseError}`);
  }

  let classifications: any[] = Array.isArray(parsed)
    ? parsed
    : parsed?.results || parsed?.payees || parsed?.classifications || parsed?.data;

  const validated = classificationResponseSchema.parse(classifications).slice(0, expectedCount);
  logger.info(`[VALIDATION] Extracted ${validated.length} classifications, expected ${expectedCount}`);
  return validated;
}

/**
 * Process a single batch of payee names with retry and caching
 */
async function processBatch(
  batchItems: BatchItem[],
  batchNumber: number,
  openaiClient: any, // Fixed: Changed from Promise<OpenAI> to any to match usage
  timeout: number
): Promise<Array<{
  payeeName: string;
  classification: 'Business' | 'Individual';
  confidence: number;
  reasoning: string;
  source: 'api';
}>> {
  logger.info(`[OPTIMIZED] Processing batch ${batchNumber} with ${batchItems.length} names`);

    try {
      const validatedClassifications = await withRetry(async () => {
        const prompt =
          `Classify each payee name as "Business" or "Individual". Return ONLY a JSON array:\n` +
          `[\n  {"name": "payee_name", "classification": "Business", "confidence": 95, "reasoning": "brief reason"},\n` +
          `  {"name": "next_payee", "classification": "Individual", "confidence": 90, "reasoning": "brief reason"}\n]\n\n` +
          `Names to classify:\n${batchItems
            .map((item, idx) => `${idx + 1}. "${item.processed}"`)
            .join('\n')}`;

        const apiCall = openaiClient.chat.completions.create({
          model: CLASSIFICATION_MODEL,
          messages: [
            { role: 'system', content: 'You are an expert classifier. Return only valid JSON array, no other text.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 800
        });

        const response = await timeoutPromise(apiCall, timeout);
        const content = (response as any)?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from OpenAI API');
        }

        return validateApiResponse(content, batchItems.length);
      });

    const batchOutput: Array<{
      payeeName: string;
      classification: 'Business' | 'Individual';
      confidence: number;
      reasoning: string;
      source: 'api';
    }> = [];

    validatedClassifications.forEach((result, index) => {
      if (index < batchItems.length) {
        const originalName = batchItems[index].original;
        const classificationResult = {
          payeeName: originalName,
          classification: result.classification as 'Business' | 'Individual',
          confidence: result.confidence,
          reasoning: result.reasoning,
          source: 'api' as const
        };

        batchOutput.push(classificationResult);

        try {
          setCachedResult(originalName, {
            classification: classificationResult.classification,
            confidence: classificationResult.confidence,
            reasoning: classificationResult.reasoning,
            timestamp: Date.now()
          });
        } catch (cacheError) {
          logger.warn(`[OPTIMIZED] Failed to cache result for "${originalName}":`, cacheError);
        }

        logger.info(`[OPTIMIZED] Classified "${originalName}": ${result.classification} (${result.confidence}%)`);
      }
    });

    if (validatedClassifications.length < batchItems.length) {
      for (let j = validatedClassifications.length; j < batchItems.length; j++) {
        const missingName = batchItems[j].original;
        if (missingName) {
          batchOutput.push(createFallbackResult(missingName, 'Incomplete API response'));
        }
      }
    }

    return batchOutput;
  } catch (error) {
    logger.error(`[OPTIMIZED] Batch ${batchNumber} failed:`, error);

    const fallback: Array<{
      payeeName: string;
      classification: 'Business' | 'Individual';
      confidence: number;
      reasoning: string;
      source: 'api';
    }> = [];
    batchItems.forEach(item => {
      if (item.original) {
        fallback.push(
          createFallbackResult(
            item.original,
            error instanceof Error ? error.message : 'Unknown error'
          )
        );
      }
    });
    return fallback;
  }
}

/**
 * Classify multiple payees in an optimized batch
 */
export async function optimizedBatchClassification(
  payeeNames: string[],
  timeout: number = DEFAULT_API_TIMEOUT
): Promise<Array<{
  payeeName: string;
  classification: 'Business' | 'Individual';
  confidence: number;
  reasoning: string;
  source: 'cache' | 'api';
}>> {
  logger.info(`[OPTIMIZED] Starting classification of ${payeeNames.length} payees`);

  // Input validation
  if (!Array.isArray(payeeNames)) {
    logger.error('[OPTIMIZED] Invalid input: payeeNames is not an array');
    return [];
  }

  const openaiClient = await getOpenAIClient(); // Fixed: Properly await the client
  if (!openaiClient) {
    throw new Error("OpenAI client not initialized. Please check your API key.");
  }

  // Filter and validate names
  const validNames = payeeNames.filter(name => name && typeof name === 'string' && name.trim());
  if (validNames.length === 0) {
    logger.warn('[OPTIMIZED] No valid names to process');
    return [];
  }

  const results: Array<{
    payeeName: string;
    classification: 'Business' | 'Individual';
    confidence: number;
    reasoning: string;
    source: 'cache' | 'api';
  }> = [];

  // Step 1: Check cache
  const uncachedNames: string[] = [];
  for (const name of validNames) {
    try {
      const cached = getCachedResult(name);
      if (cached) {
        results.push({
          payeeName: name,
          classification: cached.classification,
          confidence: cached.confidence,
          reasoning: cached.reasoning,
          source: 'cache'
        });
      } else {
        uncachedNames.push(name);
      }
    } catch (error) {
      logger.error(`[OPTIMIZED] Cache error for "${name}":`, error);
      uncachedNames.push(name);
    }
  }

  logger.info(`[OPTIMIZED] Cache: ${results.length} hits, ${uncachedNames.length} need API`);

  // Step 2: Process uncached names in batches with controlled concurrency
  if (uncachedNames.length > 0) {
    const items: BatchItem[] = uncachedNames.map(name => {
      const processed = preprocessPayeeDescription(name, Math.floor(MAX_TOKENS / 4));
      return { original: name, processed, tokens: estimateTokens(processed) };
    });

    const batches: BatchItem[][] = [];
    const MICRO_BATCH_SIZE = 20;
    const MIN_BATCH_SIZE = 10;
    for (let i = 0; i < items.length; i += MICRO_BATCH_SIZE) {
      const slice = items.slice(i, i + MICRO_BATCH_SIZE);
      if (slice.length < MIN_BATCH_SIZE && batches.length > 0) {
        batches[batches.length - 1].push(...slice);
      } else {
        batches.push(slice);
      }
    }

    let active: Promise<Array<{ payeeName: string; classification: 'Business' | 'Individual'; confidence: number; reasoning: string; source: 'api'; }>>[] = [];

    for (let i = 0; i < batches.length; i++) {
      active.push(processBatch(batches[i], i + 1, openaiClient, timeout));
      if (active.length === MAX_PARALLEL_BATCHES || i === batches.length - 1) {
        const resolved = await Promise.all(active);
        resolved.forEach(r => results.push(...r));
        active = [];
      }
    }
  }
  const orderedResults = validNames.map(name => {
    const result = results.find(r => r.payeeName === name);
    if (!result) {
      logger.warn(`[OPTIMIZED] Missing result for "${name}", creating fallback`);
      return createFallbackResult(name, 'No result found');
    }
    return result;
  });
  
  logger.info(`[OPTIMIZED] Completed: ${orderedResults.length} total, ${results.filter(r => r.source === 'cache').length} cached, ${results.filter(r => r.source === 'api').length} from API`);
  return orderedResults;
}

/**
 * Clear the classification cache
 */
export function clearClassificationCache(): void {
  classificationCache.clear();
  if (persistCache && typeof localStorage !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
  logger.info('[CACHE] Classification cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; hitRate: number } {
  const size = classificationCache.size;
  const hitRate = cacheLookups === 0 ? 0 : cacheHits / cacheLookups;
  return {
    size,
    hitRate
  };
}

/**
 * Enable or disable cache persistence
 */
export function setCachePersistence(enabled: boolean): void {
  persistCache = enabled;
}
