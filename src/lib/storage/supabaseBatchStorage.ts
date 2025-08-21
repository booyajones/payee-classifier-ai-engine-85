
import { createClient } from '@supabase/supabase-js';
import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob } from './batchJobStorage';
import { logger } from '@/lib/logger';
import { OriginalRow } from '@/lib/types';

// Initialize Supabase client (users will need to set these in their environment)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export interface SupabaseBatchJob {
  id: string;
  user_id?: string;
  job_data: any;
  payee_names: string[];
  original_file_data: OriginalRow[];
  created_at: string;
  updated_at: string;
  status: string;
  is_archived: boolean;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/**
 * Save batch job to Supabase
 */
export async function saveJobToSupabase(job: StoredBatchJob): Promise<void> {
  if (!supabase) {
    logger.warn('[SUPABASE] Not configured, skipping save');
    return;
  }

  try {
    const supabaseJob: Omit<SupabaseBatchJob, 'created_at' | 'updated_at'> = {
      id: job.id,
      job_data: job,
      payee_names: job.payeeNames,
      original_file_data: job.originalFileData,
      status: job.status,
      is_archived: false
    };

    const { error } = await supabase
      .from('batch_jobs')
      .upsert(supabaseJob, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    logger.info(`[SUPABASE] Saved job ${job.id} to database`);
  } catch (error) {
    logger.error(`[SUPABASE] Failed to save job ${job.id}:`, error);
    throw error;
  }
}

/**
 * Load batch jobs from Supabase
 */
export async function loadJobsFromSupabase(): Promise<StoredBatchJob[]> {
  if (!supabase) {
    logger.warn('[SUPABASE] Not configured, returning empty array');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const jobs: StoredBatchJob[] = (data || []).map((row: SupabaseBatchJob) => ({
      ...row.job_data,
      payeeNames: row.payee_names,
      originalFileData: row.original_file_data,
      createdAt: new Date(row.created_at).getTime()
    }));

    logger.info(`[SUPABASE] Loaded ${jobs.length} jobs from database`);
    return jobs;
  } catch (error) {
    logger.error('[SUPABASE] Failed to load jobs:', error);
    return [];
  }
}

/**
 * Delete job from Supabase (archive instead of hard delete)
 */
export async function archiveJobInSupabase(jobId: string): Promise<void> {
  if (!supabase) {
    logger.warn('[SUPABASE] Not configured, skipping archive');
    return;
  }

  try {
    const { error } = await supabase
      .from('batch_jobs')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) {
      throw error;
    }

    logger.info(`[SUPABASE] Archived job ${jobId}`);
  } catch (error) {
    logger.error(`[SUPABASE] Failed to archive job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Update job status in Supabase
 */
export async function updateJobInSupabase(job: BatchJob): Promise<void> {
  if (!supabase) {
    logger.warn('[SUPABASE] Not configured, skipping update');
    return;
  }

  try {
    const { error } = await supabase
      .from('batch_jobs')
      .update({ 
        job_data: job,
        status: job.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (error) {
      throw error;
    }

    logger.info(`[SUPABASE] Updated job ${job.id} status to ${job.status}`);
  } catch (error) {
    logger.error(`[SUPABASE] Failed to update job ${job.id}:`, error);
    throw error;
  }
}

/**
 * Sync localStorage with Supabase
 */
export async function syncBatchJobs(): Promise<StoredBatchJob[]> {
  if (!supabase) {
    // Return localStorage jobs if Supabase not configured
    const { loadBatchJobs } = await import('./batchJobStorage');
    return loadBatchJobs();
  }

  try {
    // Load from both sources
    const [supabaseJobs, localJobs] = await Promise.all([
      loadJobsFromSupabase(),
      import('./batchJobStorage').then(module => module.loadBatchJobs())
    ]);

    // Merge jobs, prioritizing Supabase data
    const jobMap = new Map<string, StoredBatchJob>();
    
    // Add local jobs first
    localJobs.forEach(job => jobMap.set(job.id, job));
    
    // Override with Supabase jobs (newer data)
    supabaseJobs.forEach(job => jobMap.set(job.id, job));

    const mergedJobs = Array.from(jobMap.values());
    
    // Save merged results back to localStorage
    const { saveBatchJobs } = await import('./batchJobStorage');
    saveBatchJobs(mergedJobs);

    logger.info(`[SUPABASE] Synced ${mergedJobs.length} jobs (${supabaseJobs.length} from Supabase, ${localJobs.length} from localStorage)`);
    return mergedJobs;
  } catch (error) {
    logger.error('[SUPABASE] Sync failed, falling back to localStorage:', error);
    const { loadBatchJobs } = await import('./batchJobStorage');
    return loadBatchJobs();
  }
}
