import { createClient } from '@supabase/supabase-js';
import { PayeeClassification, BatchProcessingResult } from '@/lib/types';
import { BatchJob } from '@/lib/openai/trueBatchAPI';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  console.log(`[RESULT STORAGE] Saving ${results.length} results to database`);
  
  const businessCount = results.filter(r => r.result.classification === 'Business').length;
  const individualCount = results.filter(r => r.result.classification === 'Individual').length;
  const excludedCount = results.filter(r => r.result.processingTier === 'Excluded').length;
  const aiProcessedCount = results.filter(r => r.result.processingTier === 'AI-Powered').length;
  const errorCount = results.filter(r => r.result.processingTier === 'Failed').length;

  const resultRecord = {
    job_id: jobId,
    job_type: jobType,
    total_payees: results.length,
    business_count: businessCount,
    individual_count: individualCount,
    excluded_count: excludedCount,
    ai_processed_count: aiProcessedCount,
    error_count: errorCount,
    processing_time_ms: summary.processingTime,
    summary,
    classifications: results
  };

  const { data, error } = await supabase
    .from('processing_results')
    .insert(resultRecord)
    .select()
    .single();

  if (error) {
    console.error('[RESULT STORAGE] Error saving results:', error);
    throw new Error(`Failed to save results: ${error.message}`);
  }

  console.log(`[RESULT STORAGE] Successfully saved results with ID: ${data.id}`);
  return data.id;
};

export const getProcessingHistory = async (): Promise<StoredBatchResult[]> => {
  console.log('[RESULT STORAGE] Fetching processing history');
  
  const { data, error } = await supabase
    .from('processing_results')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[RESULT STORAGE] Error fetching history:', error);
    throw new Error(`Failed to fetch history: ${error.message}`);
  }

  return data || [];
};

export const getResultById = async (id: string): Promise<StoredBatchResult | null> => {
  const { data, error } = await supabase
    .from('processing_results')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[RESULT STORAGE] Error fetching result:', error);
    return null;
  }

  return data;
};

export const deleteResult = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('processing_results')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[RESULT STORAGE] Error deleting result:', error);
    throw new Error(`Failed to delete result: ${error.message}`);
  }
};
