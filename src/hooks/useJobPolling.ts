
import { useState, useRef, useCallback } from 'react';
import { BatchJob, checkBatchJobStatus } from '@/lib/openai/trueBatchAPI';
import { useToast } from '@/components/ui/use-toast';

interface PollingState {
  isPolling: boolean;
  pollCount: number;
  lastError?: string;
  lastSuccessfulPoll?: number;
  consecutiveFailures?: number;
}

export const useJobPolling = (
  onJobUpdate: (job: BatchJob) => void,
  onJobCompleted?: (job: BatchJob) => void
) => {
  const [pollingStates, setPollingStates] = useState<Record<string, PollingState>>({});
  const intervalRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const { toast } = useToast();

  const stopPolling = useCallback((jobId: string) => {
    if (intervalRefs.current[jobId]) {
      clearInterval(intervalRefs.current[jobId]);
      delete intervalRefs.current[jobId];
    }
    
    setPollingStates(prev => ({
      ...prev,
      [jobId]: { ...prev[jobId], isPolling: false }
    }));
  }, []);

  const startPolling = useCallback((jobId: string) => {
    if (intervalRefs.current[jobId]) {
      clearInterval(intervalRefs.current[jobId]);
    }

    setPollingStates(prev => ({
      ...prev,
      [jobId]: { 
        isPolling: true, 
        pollCount: 0, 
        consecutiveFailures: 0,
        lastSuccessfulPoll: Date.now()
      }
    }));

    const pollJob = async (currentPollCount: number) => {
      try {
        const updatedJob = await checkBatchJobStatus(jobId);
        onJobUpdate(updatedJob);

        setPollingStates(prev => ({
          ...prev,
          [jobId]: { 
            ...prev[jobId], 
            pollCount: currentPollCount + 1,
            lastError: undefined,
            lastSuccessfulPoll: Date.now(),
            consecutiveFailures: 0
          }
        }));

        if (updatedJob.status === 'completed') {
          stopPolling(jobId);
          if (onJobCompleted) {
            onJobCompleted(updatedJob);
          }
          toast({
            title: "Batch Job Completed",
            description: `Job ${jobId.slice(-8)} finished processing.`,
          });
          return;
        }

        if (['failed', 'expired', 'cancelled'].includes(updatedJob.status)) {
          stopPolling(jobId);
          return;
        }

        intervalRefs.current[jobId] = setTimeout(() => {
          pollJob(currentPollCount + 1);
        }, 60000);

      } catch (error) {
        const newConsecutiveFailures = (pollingStates[jobId]?.consecutiveFailures || 0) + 1;
        
        setPollingStates(prev => ({
          ...prev,
          [jobId]: { 
            ...prev[jobId], 
            lastError: error instanceof Error ? error.message : 'Unknown error',
            consecutiveFailures: newConsecutiveFailures
          }
        }));

        if (newConsecutiveFailures >= 3) {
          stopPolling(jobId);
          toast({
            title: "Polling Stopped",
            description: `Stopped checking job ${jobId.slice(-8)} due to repeated errors.`,
            variant: "destructive",
          });
          return;
        }

        intervalRefs.current[jobId] = setTimeout(() => {
          pollJob(currentPollCount + 1);
        }, 60000);
      }
    };

    intervalRefs.current[jobId] = setTimeout(() => {
      pollJob(0);
    }, 60000);
  }, [onJobUpdate, onJobCompleted, stopPolling, toast, pollingStates]);

  const manualRefresh = useCallback(async (jobId: string) => {
    try {
      const updatedJob = await checkBatchJobStatus(jobId);
      onJobUpdate(updatedJob);
      
      setPollingStates(prev => ({
        ...prev,
        [jobId]: { 
          ...prev[jobId], 
          lastError: undefined,
          lastSuccessfulPoll: Date.now(),
          consecutiveFailures: 0
        }
      }));
      
      if (updatedJob.status === 'completed' && onJobCompleted) {
        onJobCompleted(updatedJob);
      } else if (['validating', 'in_progress', 'finalizing'].includes(updatedJob.status)) {
        startPolling(jobId);
      }
      
      return updatedJob;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPollingStates(prev => ({
        ...prev,
        [jobId]: { 
          ...prev[jobId], 
          lastError: errorMessage
        }
      }));
      throw error;
    }
  }, [onJobUpdate, onJobCompleted, startPolling]);

  return {
    pollingStates,
    startPolling,
    stopPolling,
    manualRefresh
  };
};
