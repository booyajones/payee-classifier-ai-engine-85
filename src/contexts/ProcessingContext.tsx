
import React, { createContext, useContext, useState, useCallback } from 'react';

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

  const addJob = useCallback((job: Omit<ProcessingJob, 'lastUpdateTime'>) => {
    const newJob: ProcessingJob = {
      ...job,
      lastUpdateTime: Date.now()
    };
    setActiveJobs(prev => [...prev, newJob]);
  }, []);

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

  const removeJob = useCallback((id: string) => {
    setActiveJobs(prev => prev.filter(job => job.id !== id));
  }, []);

  const pauseJob = useCallback((id: string) => {
    updateJob(id, { status: 'paused' });
  }, [updateJob]);

  const resumeJob = useCallback((id: string) => {
    updateJob(id, { status: 'running' });
  }, [updateJob]);

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
