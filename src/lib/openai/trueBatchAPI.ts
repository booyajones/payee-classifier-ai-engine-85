
import { getOpenAIClient } from './client';
import { makeAPIRequest } from './apiUtils';
import { logger } from '../logger';

export interface BatchJob {
  id: string;
  object: string;
  endpoint: string;
  errors: any;
  input_file_id: string;
  completion_window: string;
  status: 'validating' | 'failed' | 'in_progress' | 'finalizing' | 'completed' | 'expired' | 'cancelled';
  output_file_id: string | null;
  error_file_id: string | null;
  created_at: number;
  in_progress_at?: number;
  expires_at: number;
  finalizing_at?: number;
  completed_at?: number;
  failed_at?: number;
  expired_at?: number;
  cancelling_at?: number;
  cancelled_at?: number;
  request_counts: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata?: {
    description?: string;
    payee_count?: string;
  };
  estimated_time?: number;
  status_url?: string;
}

export interface BatchResult {
  id: string;
  custom_id: string;
  response?: {
    status_code: number;
    request_id: string;
    body: {
      id: string;
      object: string;
      created: number;
      model: string;
      choices: Array<{
        index: number;
        message: {
          role: string;
          content: string;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ProcessedBatchResult {
  status: 'success' | 'error';
  classification?: 'Business' | 'Individual';
  confidence?: number;
  reasoning?: string;
  error?: string;
  originalRowIndex?: number;
}

export async function checkBatchJobStatus(jobId: string): Promise<BatchJob> {
  logger.info(`[BATCH API] Checking status for job: ${jobId}`);
  
  try {
    const openaiClient = await getOpenAIClient();
    if (!openaiClient) {
      throw new Error("OpenAI client not initialized. Please check your API key.");
    }

    const result = await makeAPIRequest(
      () => openaiClient.batches.retrieve(jobId),
      { isStatusCheck: true, retries: 3, retryDelay: 2000 }
    );

    logger.info(`[BATCH API] Job ${jobId} status: ${result.status}`);
    
    // Ensure the result matches our BatchJob interface
    return {
      ...result,
      errors: result.errors || null
    } as BatchJob;
  } catch (error) {
    logger.error(`[BATCH API] Failed to check status for job ${jobId}:`, error);
    
    // Handle 404 errors specifically
    if (error instanceof Error && (error.message.includes('404') || error.message.includes('No batch found'))) {
      throw new Error(`404 No batch found with id '${jobId}'. The job may have been deleted or expired.`);
    }
    
    throw error;
  }
}

export async function createBatchJob(
  payeeNames: string[],
  description?: string,
  originalRowIndexes?: number[]
): Promise<BatchJob> {
  logger.info(`[BATCH API] Creating batch job for ${payeeNames.length} payees`);
  
  try {
    const openaiClient = await getOpenAIClient();
    if (!openaiClient) {
      logger.error("[BATCH API] OpenAI client not initialized");
      throw new Error("OpenAI client not initialized. Please check your API key.");
    }

    logger.info("[BATCH API] OpenAI client ready, creating requests...");

    // Create JSONL content with preserved row indexes
    const requests = payeeNames.map((name, arrayIndex) => {
      const originalRowIndex = originalRowIndexes?.[arrayIndex] ?? arrayIndex;
      const customId = `payee-${originalRowIndex}-${arrayIndex}`;
      
      logger.info(`[BATCH API] Creating request for "${name}" - originalRow: ${originalRowIndex}, arrayIndex: ${arrayIndex}, customId: ${customId}`);
      
      return {
        custom_id: customId,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert at classifying payee names as either 'Business' or 'Individual'. Analyze the given name and provide a classification with confidence level and reasoning."
            },
            {
              role: "user",
              content: `Classify this payee name: "${name}"\n\nRespond with a JSON object containing:\n- classification: "Business" or "Individual"\n- confidence: number from 0-100\n- reasoning: brief explanation for your decision`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 200
        }
      };
    });

    const jsonlContent = requests.map(req => JSON.stringify(req)).join('\n');
    logger.info(`[BATCH API] Created JSONL content with ${requests.length} requests`);
    
    const blob = new Blob([jsonlContent], { type: 'application/json' });
    const file = new File([blob], 'batch_requests.jsonl', { type: 'application/json' });

    logger.info("[BATCH API] Uploading file to OpenAI...");
    
    // Upload file with retry
    const uploadedFile = await makeAPIRequest(
      () => openaiClient.files.create({
        file: file,
        purpose: 'batch'
      }),
      { retries: 2, retryDelay: 3000 }
    );

    logger.info(`[BATCH API] File uploaded successfully: ${uploadedFile.id}`);

    // Create batch job with retry
    logger.info("[BATCH API] Creating batch job...");
    const result = await makeAPIRequest(
      () => openaiClient.batches.create({
        input_file_id: uploadedFile.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: {
          description: description || `Payee classification batch: ${payeeNames.length} payees`,
          payee_count: payeeNames.length.toString()
        }
      }),
      { retries: 2, retryDelay: 3000 }
    );

    logger.info(`[BATCH API] Batch job created successfully: ${result.id}`);
    
    // Ensure the result matches our BatchJob interface and include polling info
    const estimated_time = Math.max(1, Math.ceil(result.request_counts.total));
    return {
      ...result,
      errors: result.errors || null,
      estimated_time,
      status_url: `/api/batches/${result.id}/status`
    } as BatchJob;
  } catch (error) {
    logger.error(`[BATCH API] Failed to create batch job:`, error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        throw new Error("API quota exceeded. Please try again later or check your OpenAI usage limits.");
      }
      if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        throw new Error("Authentication failed. Please check your OpenAI API key.");
      }
      if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error("Network error. Please check your internet connection and try again.");
      }
    }
    
    throw new Error(`Failed to create batch job: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download and parse the results for a completed batch job.
 */
export async function getBatchJobResults(
  job: BatchJob,
  payeeNames: string[],
  originalRowIndexes?: number[]
): Promise<ProcessedBatchResult[]> {
  logger.info(`[BATCH API] Getting results for job: ${job.id}`);

  if (job.status !== 'completed') {
    throw new Error('Batch job is not completed');
  }

  if (!job.output_file_id) {
    throw new Error('Batch job has no output file');
  }

  try {
    const openaiClient = await getOpenAIClient();
    if (!openaiClient) {
      throw new Error("OpenAI client not initialized. Please check your API key.");
    }

    // Download results with retry
    const fileContent = await makeAPIRequest(
      () => openaiClient.files.content(job.output_file_id!),
      { retries: 3, retryDelay: 2000 }
    );

    const text = await fileContent.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    logger.info(`[BATCH API] Downloaded ${lines.length} result lines`);
    
    // Initialize results array with proper size
    const results: ProcessedBatchResult[] = new Array(payeeNames.length).fill(null);
    
    for (const line of lines) {
      try {
        const result: BatchResult = JSON.parse(line);
        const customId = result.custom_id;
        
        // Parse custom_id to extract both original row index and array index
        const customIdMatch = customId.match(/^payee-(\d+)-(\d+)$/);
        if (!customIdMatch) {
          logger.warn(`[BATCH API] Invalid custom_id format: ${customId}`);
          continue;
        }
        
        const originalRowIndex = parseInt(customIdMatch[1]);
        const arrayIndex = parseInt(customIdMatch[2]);
        
        logger.info(`[BATCH API] Processing result for customId: ${customId}, originalRow: ${originalRowIndex}, arrayIndex: ${arrayIndex}`);
        
        if (originalRowIndex >= 0 && originalRowIndex < payeeNames.length) {
          if (result.response?.body?.choices?.[0]?.message?.content) {
            try {
              const content = JSON.parse(result.response.body.choices[0].message.content);
              results[originalRowIndex] = {
                status: 'success',
                classification: content.classification,
                confidence: content.confidence,
                reasoning: content.reasoning,
                originalRowIndex: originalRowIndex
              };
            } catch (parseError) {
              logger.error(`[BATCH API] Failed to parse response for ${customId}:`, parseError);
              results[originalRowIndex] = {
                status: 'error',
                error: 'Failed to parse classification result',
                originalRowIndex: originalRowIndex
              };
            }
          } else if (result.error) {
            results[originalRowIndex] = {
              status: 'error',
              error: result.error.message,
              originalRowIndex: originalRowIndex
            };
          } else {
            results[originalRowIndex] = {
              status: 'error',
              error: 'No response data',
              originalRowIndex: originalRowIndex
            };
          }
        } else {
          logger.warn(`[BATCH API] Array index ${arrayIndex} out of bounds for ${payeeNames.length} payees`);
        }
      } catch (error) {
        logger.error('[BATCH API] Failed to parse result line:', error);
      }
    }
    
    // Fill any null results with error status
    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        const originalRowIndex = originalRowIndexes?.[i] ?? i;
        results[i] = {
          status: 'error',
          error: 'No result found',
          originalRowIndex: originalRowIndex
        };
      }
    }
    
    logger.info(`[BATCH API] Processed ${results.length} results`);
    return results;
  } catch (error) {
    logger.error(`[BATCH API] Failed to get results for job ${job.id}:`, error);
    
    // Handle 404 errors specifically
    if (error instanceof Error && (error.message.includes('404') || error.message.includes('No batch found'))) {
      throw new Error(`404 No batch found with id '${job.id}'. The job may have been deleted or expired.`);
    }
    
    throw error;
  }
}

export async function cancelBatchJob(jobId: string): Promise<BatchJob> {
  logger.info(`[BATCH API] Cancelling job: ${jobId}`);
  
  try {
    const openaiClient = await getOpenAIClient();
    if (!openaiClient) {
      throw new Error("OpenAI client not initialized. Please check your API key.");
    }

    const result = await makeAPIRequest(
      () => openaiClient.batches.cancel(jobId),
      { retries: 2, retryDelay: 2000 }
    );

    // Ensure the result matches our BatchJob interface
    return {
      ...result,
      errors: result.errors || null
    } as BatchJob;
  } catch (error) {
    logger.error(`[BATCH API] Failed to cancel job ${jobId}:`, error);
    
    // Handle 404 errors specifically
    if (error instanceof Error && (error.message.includes('404') || error.message.includes('No batch found'))) {
      throw new Error(`404 No batch found with id '${jobId}'. The job may have been deleted or expired.`);
    }
    
    throw error;
  }
}
