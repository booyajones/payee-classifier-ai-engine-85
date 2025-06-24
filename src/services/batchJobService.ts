import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob, isValidBatchJobId } from '@/lib/storage/batchJobStorage';
import { storageService } from './storageService';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'batchJobs';

export class BatchJobService {
  async loadJobs(): Promise<StoredBatchJob[]> {
    try {
      logger.info('[BATCH SERVICE] Loading jobs from storage...');
      const stored = storageService.getItem(STORAGE_KEY);
      if (!stored) {
        logger.info('[BATCH SERVICE] No stored jobs found');
        return [];
      }
      
      const jobs: StoredBatchJob[] = JSON.parse(stored);
      logger.info(`[BATCH SERVICE] Found ${jobs.length} stored jobs`);
      
      const validJobs = jobs.filter(job => {
        const isValid = isValidBatchJobId(job.id);
        if (!isValid) {
          logger.warn(`[BATCH SERVICE] Removing invalid job: ${job.id}`);
        }
        return isValid;
      });
      
      if (validJobs.length !== jobs.length) {
        logger.info(`[BATCH SERVICE] Filtered out ${jobs.length - validJobs.length} invalid jobs`);
        await this.saveJobs(validJobs);
      }
      
      logger.info(`[BATCH SERVICE] Successfully loaded ${validJobs.length} valid jobs`);
      return validJobs;
    } catch (error) {
      logger.error('[BATCH SERVICE] Error loading jobs:', error);
      return [];
    }
  }

  async saveJobs(jobs: StoredBatchJob[]): Promise<boolean> {
    try {
      logger.info(`[BATCH SERVICE] Attempting to save ${jobs.length} jobs to storage`);
      
      // Check storage before saving
      const storageInfo = this.getStorageInfo();
      logger.info(`[BATCH SERVICE] Storage status: ${storageInfo.storageStatus}, fallback: ${storageInfo.isUsingFallback}`);
      
      // Run cleanup before saving if storage is getting full
      const currentSize = storageService.getSize();
      const maxSize = 4 * 1024 * 1024; // 4MB
      const usagePercent = currentSize / maxSize;
      
      if (usagePercent > 0.7) {
        logger.info(`[BATCH SERVICE] Storage usage at ${(usagePercent * 100).toFixed(1)}%, running cleanup`);
        storageService.cleanup();
      }
      
      const success = storageService.setItem(STORAGE_KEY, JSON.stringify(jobs));
      if (!success) {
        logger.error('[BATCH SERVICE] Failed to save jobs to storage');
        return false;
      }
      
      logger.info(`[BATCH SERVICE] Successfully saved ${jobs.length} jobs to storage`);
      return true;
    } catch (error) {
      logger.error('[BATCH SERVICE] Error saving jobs:', error);
      return false;
    }
  }

  async addJob(batchJob: BatchJob, payeeNames: string[], originalFileData: any[]): Promise<void> {
    logger.info(`[BATCH SERVICE] Starting to add job: ${batchJob.id}`);
    logger.info(`[BATCH SERVICE] Job details - Status: ${batchJob.status}, Payees: ${payeeNames.length}, Data rows: ${originalFileData.length}`);
    
    if (!isValidBatchJobId(batchJob.id)) {
      const error = `Invalid batch job ID format: ${batchJob.id}`;
      logger.error(`[BATCH SERVICE] ${error}`);
      throw new Error(error);
    }

    // Check if we should store file data based on storage constraints
    const shouldStoreFileData = !storageService.isUsingFallback && originalFileData.length < 1000;
    logger.info(`[BATCH SERVICE] Will store file data: ${shouldStoreFileData} (fallback: ${storageService.isUsingFallback}, rows: ${originalFileData.length})`);
    
    const storedJob: StoredBatchJob = {
      ...batchJob,
      payeeNames,
      originalFileData: shouldStoreFileData ? originalFileData : [],
      created_at: Date.now()
    };
    
    logger.info('[BATCH SERVICE] Created stored job object, loading existing jobs...');
    const jobs = await this.loadJobs();
    logger.info(`[BATCH SERVICE] Loaded ${jobs.length} existing jobs`);
    
    const newJobs = [storedJob, ...jobs];
    logger.info(`[BATCH SERVICE] Created new jobs array with ${newJobs.length} total jobs`);
    
    const saved = await this.saveJobs(newJobs);
    if (!saved && storageService.isUsingFallback) {
      logger.warn('[BATCH SERVICE] Save failed, using fallback strategy');
      // Keep only essential jobs in memory
      const essentialJobs = newJobs.filter(job => 
        ['in_progress', 'validating', 'finalizing'].includes(job.status)
      ).slice(0, 5);
      logger.info(`[BATCH SERVICE] Keeping ${essentialJobs.length} essential jobs in fallback storage`);
      await this.saveJobs(essentialJobs);
    }
    
    logger.info(`[BATCH SERVICE] Successfully added job: ${batchJob.id} (storage success: ${saved})`);
  }

  async updateJob(updatedJob: BatchJob): Promise<void> {
    logger.info(`[BATCH SERVICE] Updating job: ${updatedJob.id} to status: ${updatedJob.status}`);
    
    if (!isValidBatchJobId(updatedJob.id)) {
      logger.error(`[BATCH SERVICE] Cannot update invalid job ID: ${updatedJob.id}`);
      return;
    }

    const jobs = await this.loadJobs();
    const jobIndex = jobs.findIndex(job => job.id === updatedJob.id);
    
    if (jobIndex === -1) {
      logger.warn(`[BATCH SERVICE] Job not found for update: ${updatedJob.id}`);
      return;
    }
    
    const newJobs = jobs.map(job => 
      job.id === updatedJob.id 
        ? { ...job, ...updatedJob }
        : job
    );
    
    const saved = await this.saveJobs(newJobs);
    logger.info(`[BATCH SERVICE] Updated job: ${updatedJob.id} (storage success: ${saved})`);
  }

  async deleteJob(jobId: string): Promise<void> {
    logger.info(`[BATCH SERVICE] Deleting job: ${jobId}`);
    const jobs = await this.loadJobs();
    const newJobs = jobs.filter(job => job.id !== jobId);
    await this.saveJobs(newJobs);
    logger.info(`[BATCH SERVICE] Deleted job: ${jobId} (${jobs.length - newJobs.length} jobs removed)`);
  }

  async getJobById(jobId: string): Promise<StoredBatchJob | undefined> {
    const jobs = await this.loadJobs();
    return jobs.find(job => job.id === jobId);
  }

  getStorageInfo() {
    return {
      storageStatus: storageService.storageStatus,
      isUsingFallback: storageService.isUsingFallback,
      storageSize: storageService.getSize()
    };
  }
}

export const batchJobService = new BatchJobService();
