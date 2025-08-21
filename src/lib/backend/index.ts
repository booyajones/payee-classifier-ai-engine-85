import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PayeeClassification } from '@/lib/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = (): boolean => !!supabase;

export interface UploadBatchRecord {
  id?: string;
  job_id?: string;
  job_type: 'direct' | 'batch';
  total_payees: number;
  business_count: number;
  individual_count: number;
  excluded_count: number;
  ai_processed_count: number;
  error_count: number;
  processing_time_ms: number;
}

export interface UploadRowRecord {
  id?: number;
  batch_id: string;
  row_index: number;
  payee_name: string;
  normalized_name: string;
  original_data?: any;
}

export interface ClassificationRecord {
  row_id: number;
  classification: PayeeClassification['result'];
}

export interface DedupeLinkRecord {
  canonical_normalized: string;
  duplicate_normalized: string;
}

export async function upsertUploadBatch(batch: UploadBatchRecord): Promise<string> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('upload_batches')
    .upsert(batch, { onConflict: 'id' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function upsertUploadRows(rows: UploadRowRecord[]): Promise<UploadRowRecord[]> {
  if (!supabase) throw new Error('Database not configured');
  const { data, error } = await supabase
    .from('upload_rows')
    .upsert(rows, { onConflict: 'batch_id,row_index' })
    .select();
  if (error) throw error;
  return data as UploadRowRecord[];
}

export async function upsertClassifications(records: ClassificationRecord[]): Promise<void> {
  if (!supabase) throw new Error('Database not configured');
  if (!records.length) return;
  const { error } = await supabase
    .from('classifications')
    .upsert(records, { onConflict: 'row_id' });
  if (error) throw error;
}

export async function upsertDedupeLinks(links: DedupeLinkRecord[]): Promise<void> {
  if (!supabase || !links.length) return;
  const { error } = await supabase
    .from('dedupe_links')
    .upsert(links, { onConflict: 'duplicate_normalized' });
  if (error) throw error;
}

export async function fetchDedupeMap(normalizedNames: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || !normalizedNames.length) return map;
  const { data, error } = await supabase
    .from('dedupe_links')
    .select('canonical_normalized, duplicate_normalized')
    .in('duplicate_normalized', normalizedNames);
  if (error) throw error;
  (data || []).forEach(row => {
    map.set(row.duplicate_normalized, row.canonical_normalized);
  });
  return map;
}
