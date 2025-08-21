import { PayeeClassification, BatchProcessingResult } from '@/lib/types';
import { normalizePayeeName } from '@/lib/classification/nameProcessing';
import {
  isSupabaseConfigured,
  upsertUploadBatch,
  upsertUploadRows,
  upsertClassifications,
  supabase,
} from '@/lib/backend';

// Version of the classification prompt used when storing results
const PROMPT_VERSION = 1;

export { isSupabaseConfigured } from '@/lib/backend';

export interface StoredBatchResult {
  id: string;
  job_id?: string;
  job_type: 'direct' | 'batch';
  total_payees: number;
  business_count: number;
  individual_count: number;
  excluded_count: number;
  ai_processed_count: number;
  error_count: number;
  processing_time_ms: number;
  created_at: string;
  summary: BatchProcessingResult;
  classifications: PayeeClassification[];
}

export const saveProcessingResults = async (
  results: PayeeClassification[],
  summary: BatchProcessingResult,
  jobId?: string,
  jobType: 'direct' | 'batch' = 'direct'
): Promise<string> => {
  if (!isSupabaseConfigured()) {
    console.warn('[RESULT STORAGE] Supabase not configured, skipping save');
    throw new Error('Database not configured. Please set up Supabase to save results.');
  }

  console.log(`[RESULT STORAGE] Saving ${results.length} results to database`);

  const businessCount = results.filter(r => r.result.classification === 'Business').length;
  const individualCount = results.filter(r => r.result.classification === 'Individual').length;
  const excludedCount = results.filter(r => r.result.processingTier === 'Excluded').length;
  const aiProcessedCount = results.filter(r => r.result.processingTier === 'AI-Powered').length;
  const errorCount = results.filter(r => r.result.processingTier === 'Failed').length;

  const batchId = await upsertUploadBatch({
    job_id: jobId,
    job_type: jobType,
    total_payees: results.length,
    business_count: businessCount,
    individual_count: individualCount,
    excluded_count: excludedCount,
    ai_processed_count: aiProcessedCount,
    error_count: errorCount,
    processing_time_ms: summary.processingTime,
  });

  const rows = results.map((r, idx) => ({
    batch_id: batchId,
    row_index: idx,
    payee_name: r.payeeName,
    normalized_name: normalizePayeeName(r.payeeName),
    original_data: r.originalData || null,
  }));

  const insertedRows = await upsertUploadRows(rows);

  // Buffer classifications in memory and persist in a single batch
  const classificationBuffer = insertedRows.map((row, idx) => ({
    row_id: row.id as number,
    prompt_version: PROMPT_VERSION,
    classification: results[idx].result,
  }));
  await upsertClassifications(classificationBuffer);

  console.log(`[RESULT STORAGE] Successfully saved results with batch ID: ${batchId}`);
  return batchId;
};

export const getResultById = async (id: string): Promise<StoredBatchResult | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('[RESULT STORAGE] Supabase not configured');
    return null;
  }

  const { data: batch, error: batchError } = await supabase!
    .from('upload_batches')
    .select('*')
    .eq('id', id)
    .single();
  if (batchError || !batch) {
    console.error('[RESULT STORAGE] Error fetching batch:', batchError);
    return null;
  }

  const { data: rows, error: rowsError } = await supabase!
    .from('upload_rows')
    .select('id, row_index, payee_name, original_data, classifications(classification,prompt_version)')
    .eq('batch_id', id)
    .order('row_index', { ascending: true });
  if (rowsError) {
    console.error('[RESULT STORAGE] Error fetching rows:', rowsError);
    return null;
  }

  const classifications: PayeeClassification[] = (rows || []).map((row: any) => ({
    id: String(row.id),
    payeeName: row.payee_name,
    result: row.classifications?.[0]?.classification,
    timestamp: new Date(batch.created_at),
    originalData: row.original_data,
    rowIndex: row.row_index,
  }));

  const batchResult: StoredBatchResult = {
    id: batch.id,
    job_id: batch.job_id,
    job_type: batch.job_type,
    total_payees: batch.total_payees,
    business_count: batch.business_count,
    individual_count: batch.individual_count,
    excluded_count: batch.excluded_count,
    ai_processed_count: batch.ai_processed_count,
    error_count: batch.error_count,
    processing_time_ms: batch.processing_time_ms,
    created_at: batch.created_at,
    classifications,
    summary: {
      results: classifications,
      successCount: batch.total_payees - batch.error_count,
      failureCount: batch.error_count,
      processingTime: batch.processing_time_ms,
      originalFileData: (rows || []).map((r: any) => r.original_data),
      enhancedStats: undefined,
    }
  };

  return batchResult;
};

export const getProcessingHistory = async (): Promise<StoredBatchResult[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('[RESULT STORAGE] Supabase not configured, returning empty history');
    throw new Error('Database not configured. Please set up Supabase to view processing history.');
  }

  const { data: batches, error } = await supabase!
    .from('upload_batches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[RESULT STORAGE] Error fetching history:', error);
    throw new Error(`Failed to fetch history: ${error.message}`);
  }

  const results: StoredBatchResult[] = [];
  for (const batch of batches || []) {
    const res = await getResultById(batch.id);
    if (res) results.push(res);
  }
  return results;
};

export const deleteResult = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Database not configured. Please set up Supabase to delete results.');
  }

  const { error } = await supabase!
    .from('upload_batches')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[RESULT STORAGE] Error deleting result:', error);
    throw new Error(`Failed to delete result: ${error.message}`);
  }
};
