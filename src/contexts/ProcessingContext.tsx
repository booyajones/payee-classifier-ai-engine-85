
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';

export interface ProcessingJob {
  id: string;
  type: 'direct' | 'batch';
  startTime: number;
  totalRows: number;
  processedRows: number;
  excludedCount: number;
  aiProcessedCount: number;
  errorCount: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  estimatedTimeRemaining?: number;
  processingSpeed?: number; // rows per minute
  lastUpdateTime: number;
  // Server reported progress
  queued?: number;
  running?: number;
  failed?: number;
  eta?: number | null;
  statusUrl?: string;
  progressUrl?: string;
}

interface ProcessingContextType {
  activeJobs: ProcessingJob[];
  addJob: (job: Omit<ProcessingJob, 'lastUpdateTime'>) => void;
  updateJob: (id: string, updates: Partial<ProcessingJob>) => void;
  removeJob: (id: string) => void;
  pauseJob: (id: string) => void;
  resumeJob: (id: string) => void;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export const ProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeJobs, setActiveJobs] = useState<ProcessingJob[]>([]);
  const pollingIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const updateJob = useCallback((id: string, updates: Partial<ProcessingJob>) => {
    setActiveJobs(prev => prev.map(job =>
      job.id === id
        ? {
            ...job,
            ...updates,
            lastUpdateTime: Date.now(),
            // Calculate processing speed if we have processed rows
            processingSpeed: updates.processedRows ?
              calculateProcessingSpeed(job, updates.processedRows) : job.processingSpeed
          }
        : job
    ));
  }, []);

  const startPolling = useCallback((job: ProcessingJob) => {
    if (!job.statusUrl && !job.progressUrl) return;

    const poll = async () => {
      try {
        const urls = [job.statusUrl, job.progressUrl].filter(Boolean) as string[];
        const responses = await Promise.all(urls.map(u => fetch(u)));
        const datas = await Promise.all(responses.map(r => r.json()));
        const data = datas[datas.length - 1];

        const done = data.rows_done ?? job.processedRows;
        const total = data.rows_total ?? job.totalRows;
        const status = done >= total ? 'completed' : job.status;

        updateJob(job.id, {
          totalRows: total,
          processedRows: done,
          aiProcessedCount: data.running ?? job.aiProcessedCount,
          errorCount: data.failed ?? job.errorCount,
          queued: data.queued,
          running: data.running,
          failed: data.failed,
          estimatedTimeRemaining: data.eta ?? undefined,
          eta: data.eta,
          status
        });

        if (status !== 'running') {
          const interval = pollingIntervals.current.get(job.id);
          if (interval) {
            clearInterval(interval);
            pollingIntervals.current.delete(job.id);
          }
        }
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 5000);
    pollingIntervals.current.set(job.id, interval);
    poll();
  }, [updateJob]);

  const addJob = useCallback((job: Omit<ProcessingJob, 'lastUpdateTime'>) => {
    const newJob: ProcessingJob = {
      ...job,
      lastUpdateTime: Date.now()
    };
    setActiveJobs(prev => [...prev, newJob]);
    startPolling(newJob);
  }, [startPolling]);

  const removeJob = useCallback((id: string) => {
    setActiveJobs(prev => prev.filter(job => job.id !== id));
    const interval = pollingIntervals.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.current.delete(id);
    }
  }, []);

  const pauseJob = useCallback((id: string) => {
    updateJob(id, { status: 'paused' });
    const interval = pollingIntervals.current.get(id);
    if (interval) clearInterval(interval);
  }, [updateJob]);

  const resumeJob = useCallback((id: string) => {
    updateJob(id, { status: 'running' });
    const job = activeJobs.find(j => j.id === id);
    if (job) startPolling(job);
  }, [updateJob, activeJobs, startPolling]);

  return (
    <ProcessingContext.Provider value={{
      activeJobs,
      addJob,
      updateJob,
      removeJob,
      pauseJob,
      resumeJob
    }}>
      {children}
    </ProcessingContext.Provider>
  );
};

export const useProcessing = () => {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
};

// Helper function to calculate processing speed
function calculateProcessingSpeed(job: ProcessingJob, newProcessedRows: number): number {
  const timeDiff = (Date.now() - job.startTime) / 1000 / 60; // minutes
  if (timeDiff === 0) return 0;
  return newProcessedRows / timeDiff;
}
