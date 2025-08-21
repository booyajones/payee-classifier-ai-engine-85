
import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob, isValidBatchJobId } from '@/lib/storage/batchJobStorage';
import { OriginalRow } from '@/lib/types';
import { ORIGINAL_FILE_DATA_LIMIT } from '@/lib/storage/config';
import { logger } from '@/lib/logger';

// Use the same storage key as the rest of the system
const STORAGE_KEY = 'lovable_batch_jobs';

interface StorageInfo {
  storageStatus: 'localStorage' | 'sessionStorage' | 'memory';
  isUsingFallback: boolean;
}

class BatchJobService {
  private jobs: Map<string, StoredBatchJob> = new Map();
  private storageAvailable = false;
  private storageType: 'localStorage' | 'sessionStorage' | 'memory' = 'memory';

  constructor() {
    this.initializeStorage();
  }

  private initializeStorage() {
    // Try localStorage first
    try {
      const testKey = 'test_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.storageAvailable = true;
      this.storageType = 'localStorage';
      logger.info('[BATCH JOB SERVICE] Using localStorage');
      return;
    } catch (error) {
      logger.warn('[BATCH JOB SERVICE] localStorage not available:', error);
    }

    // Try sessionStorage as fallback
    try {
      const testKey = 'test_storage';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      this.storageAvailable = true;
      this.storageType = 'sessionStorage';
      logger.info('[BATCH JOB SERVICE] Using sessionStorage as fallback');
      return;
    } catch (error) {
      logger.warn('[BATCH JOB SERVICE] sessionStorage not available:', error);
    }

    // Use in-memory storage as last resort
    this.storageAvailable = false;
    this.storageType = 'memory';
    logger.warn('[BATCH JOB SERVICE] Using in-memory storage only');
  }

  private getStorage() {
    return this.storageType === 'localStorage' ? localStorage : sessionStorage;
  }

  private saveToStorage(jobs: StoredBatchJob[]): boolean {
    if (!this.storageAvailable) {
      return false;
    }

    try {
      const storage = this.getStorage();
      storage.setItem(STORAGE_KEY, JSON.stringify(jobs));
      return true;
    } catch (error) {
      logger.error('[BATCH JOB SERVICE] Failed to save to storage:', error);
      return false;
    }
  }

  private loadFromStorage(): StoredBatchJob[] {
    if (!this.storageAvailable) {
      return Array.from(this.jobs.values());
    }

    try {
      const storage = this.getStorage();
      const stored = storage.getItem(STORAGE_KEY);
      if (stored) {
        const jobs: StoredBatchJob[] = JSON.parse(stored);
        return jobs.filter(job => isValidBatchJobId(job.id));
      }
    } catch (error) {
      logger.error('[BATCH JOB SERVICE] Failed to load from storage:', error);
    }

    return Array.from(this.jobs.values());
  }

  async loadJobs(): Promise<StoredBatchJob[]> {
    const jobs = this.loadFromStorage();
    
    // Update in-memory map
    this.jobs.clear();
    jobs.forEach(job => this.jobs.set(job.id, job));
    
    logger.info(`[BATCH JOB SERVICE] Loaded ${jobs.length} jobs`);
    return jobs;
  }

  async addJob(batchJob: BatchJob, payeeNames: string[], originalFileData: OriginalRow[]): Promise<void> {
    if (!isValidBatchJobId(batchJob.id)) {
      throw new Error(`Invalid batch job ID format: ${batchJob.id}`);
    }

    const storedJob: StoredBatchJob = {
      ...batchJob,
      payeeNames,
      originalFileData: originalFileData.length < ORIGINAL_FILE_DATA_LIMIT ? originalFileData : [],
      created_at: Date.now()
    };

    // Add to memory first
    this.jobs.set(batchJob.id, storedJob);
    
    // Then save to storage
    const allJobs = Array.from(this.jobs.values()).sort((a, b) => b.created_at - a.created_at);
    const saved = this.saveToStorage(allJobs);
    
    logger.info(`[BATCH JOB SERVICE] Added job ${batchJob.id} (storage: ${saved ? 'success' : 'memory-only'})`);
  }

  async updateJob(updatedJob: BatchJob): Promise<void> {
    if (!isValidBatchJobId(updatedJob.id)) {
      logger.error(`[BATCH JOB SERVICE] Cannot update invalid job ID: ${updatedJob.id}`);
      return;
    }

    const existingJob = this.jobs.get(updatedJob.id);
    if (!existingJob) {
      logger.warn(`[BATCH JOB SERVICE] Job ${updatedJob.id} not found for update`);
      return;
    }

    // Update in memory
    const updatedStoredJob = { ...existingJob, ...updatedJob };
    this.jobs.set(updatedJob.id, updatedStoredJob);
    
    // Save to storage
    const allJobs = Array.from(this.jobs.values()).sort((a, b) => b.created_at - a.created_at);
    const saved = this.saveToStorage(allJobs);
    
    logger.info(`[BATCH JOB SERVICE] Updated job ${updatedJob.id} (storage: ${saved ? 'success' : 'memory-only'})`);
  }

  async deleteJob(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
    
    const allJobs = Array.from(this.jobs.values()).sort((a, b) => b.created_at - a.created_at);
    const saved = this.saveToStorage(allJobs);
    
    logger.info(`[BATCH JOB SERVICE] Deleted job ${jobId} (storage: ${saved ? 'success' : 'memory-only'})`);
  }

  getStorageInfo(): StorageInfo {
    return {
      storageStatus: this.storageType,
      isUsingFallback: this.storageType !== 'localStorage'
    };
  }
}

export const batchJobService = new BatchJobService();
