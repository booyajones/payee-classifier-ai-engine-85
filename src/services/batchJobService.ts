import { BatchJob } from '@/lib/openai/trueBatchAPI';
import { StoredBatchJob, isValidBatchJobId } from '@/lib/storage/batchJobStorage';
import { storageService } from './storageService';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'batchJobs';

export class BatchJobService {
  async loadJobs(): Promise<StoredBatchJob[]> {
    try {
      const stored = storageService.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const jobs: StoredBatchJob[] = JSON.parse(stored);
      const validJobs = jobs.filter(job => {
        const isValid = isValidBatchJobId(job.id);
        if (!isValid) {
          logger.warn(`[BATCH SERVICE] Removing invalid job: ${job.id}`);
        }
        return isValid;
      });
      
      if (validJobs.length !== jobs.length) {
        await this.saveJobs(validJobs);
      }
      
      return validJobs;
    } catch (error) {
      logger.error('[BATCH SERVICE] Error loading jobs:', error);
      return [];
    }
  }

  async saveJobs(jobs: StoredBatchJob[]): Promise<boolean> {
    try {
      const success = storageService.setItem(STORAGE_KEY, JSON.stringify(jobs));
      if (!success) {
        logger.error('[BATCH SERVICE] Failed to save jobs');
      }
      return success;
    } catch (error) {
      logger.error('[BATCH SERVICE] Error saving jobs:', error);
      return false;
    }
  }

  async addJob(batchJob: BatchJob, payeeNames: string[], originalFileData: any[]): Promise<void> {
    if (!isValidBatchJobId(batchJob.id)) {
      throw new Error(`Invalid batch job ID format: ${batchJob.id}`);
    }

    const shouldStoreFileData = !storageService.isUsingFallback && originalFileData.length < 1000;
    
    const storedJob: StoredBatchJob = {
      ...batchJob,
      payeeNames,
      originalFileData: shouldStoreFileData ? originalFileData : [],
      created_at: Date.now()
    };
    
    const jobs = await this.loadJobs();
    const newJobs = [storedJob, ...jobs];
    
    const saved = await this.saveJobs(newJobs);
    if (!saved && storageService.isUsingFallback) {
      // Keep only essential jobs in memory
      const essentialJobs = newJobs.filter(job => 
        ['in_progress', 'validating', 'finalizing'].includes(job.status)
      ).slice(0, 5);
      await this.saveJobs(essentialJobs);
    }
    
    logger.info(`[BATCH SERVICE] Added job: ${batchJob.id}`);
  }

  async updateJob(updatedJob: BatchJob): Promise<void> {
    if (!isValidBatchJobId(updatedJob.id)) {
      logger.error(`[BATCH SERVICE] Cannot update invalid job ID: ${updatedJob.id}`);
      return;
    }

    const jobs = await this.loadJobs();
    const newJobs = jobs.map(job => 
      job.id === updatedJob.id 
        ? { ...job, ...updatedJob }
        : job
    );
    
    await this.saveJobs(newJobs);
    logger.info(`[BATCH SERVICE] Updated job: ${updatedJob.id}`);
  }

  async deleteJob(jobId: string): Promise<void> {
    const jobs = await this.loadJobs();
    const newJobs = jobs.filter(job => job.id !== jobId);
    await this.saveJobs(newJobs);
    logger.info(`[BATCH SERVICE] Deleted job: ${jobId}`);
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
