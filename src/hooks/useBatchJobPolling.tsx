
import { useState, useEffect, useRef } from 'react';
import { BatchJob, checkBatchJobStatus } from '@/lib/openai/trueBatchAPI';
import { useToast } from '@/components/ui/use-toast';

interface PollingState {
  isPolling: boolean;
  pollCount: number;
  lastError?: string;
  lastSuccessfulPoll?: number;
  isRateLimited?: boolean;
  consecutiveFailures?: number;
}

export const useBatchJobPolling = (
  jobs: BatchJob[],
  onJobUpdate: (job: BatchJob) => void,
  onJobCompleted?: (job: BatchJob) => void
) => {
  const [pollingStates, setPollingStates] = useState<Record<string, PollingState>>({});
  const intervalRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const { toast } = useToast();

  // Cleanup function to clear all intervals
  const cleanupPolling = () => {
    Object.values(intervalRefs.current).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    intervalRefs.current = {};
    setPollingStates({});
  };

  // Simple 1-minute polling interval
  const getPollingInterval = (): number => {
    return 60000; // 1 minute
  };

  // Start polling for a specific job (only when manually triggered)
  const startPolling = (jobId: string) => {
    console.log(`[POLLING] Starting 1-minute polling for job ${jobId}`);
    
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
        console.log(`[POLLING] Auto-poll #${currentPollCount + 1} for job ${jobId}`);
        
        const updatedJob = await checkBatchJobStatus(jobId);
        const previousJob = jobs.find(j => j.id === jobId);
        
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

        // Check if job just completed (status changed to completed)
        if (updatedJob.status === 'completed' && previousJob?.status !== 'completed') {
          console.log(`[POLLING] Job ${jobId} just completed - triggering auto-download`);
          
          // Stop polling
          if (intervalRefs.current[jobId]) {
            clearInterval(intervalRefs.current[jobId]);
            delete intervalRefs.current[jobId];
          }
          
          setPollingStates(prev => ({
            ...prev,
            [jobId]: { ...prev[jobId], isPolling: false }
          }));

          // Trigger completion callback for auto-download
          if (onJobCompleted) {
            onJobCompleted(updatedJob);
          }

          toast({
            title: "Batch Job Completed",
            description: `Job ${jobId.slice(-8)} finished processing. Downloading results...`,
          });
          return;
        }

        // Check if job is complete but was already completed
        if (['completed', 'failed', 'expired', 'cancelled'].includes(updatedJob.status)) {
          console.log(`[POLLING] Job ${jobId} already completed with status: ${updatedJob.status}`);
          
          if (intervalRefs.current[jobId]) {
            clearInterval(intervalRefs.current[jobId]);
            delete intervalRefs.current[jobId];
          }
          
          setPollingStates(prev => ({
            ...prev,
            [jobId]: { ...prev[jobId], isPolling: false }
          }));
          return;
        }

        // Continue polling every minute
        intervalRefs.current[jobId] = setTimeout(() => {
          pollJob(currentPollCount + 1);
        }, getPollingInterval());

      } catch (error) {
        console.error(`[POLLING] Error polling job ${jobId}:`, error);
        
        const newConsecutiveFailures = (pollingStates[jobId]?.consecutiveFailures || 0) + 1;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setPollingStates(prev => ({
          ...prev,
          [jobId]: { 
            ...prev[jobId], 
            lastError: errorMessage,
            pollCount: currentPollCount + 1,
            consecutiveFailures: newConsecutiveFailures
          }
        }));

        // Stop polling after 3 failures
        if (newConsecutiveFailures >= 3) {
          console.error(`[POLLING] Stopping polling for job ${jobId} after ${newConsecutiveFailures} failures`);
          
          if (intervalRefs.current[jobId]) {
            clearInterval(intervalRefs.current[jobId]);
            delete intervalRefs.current[jobId];
          }
          
          setPollingStates(prev => ({
            ...prev,
            [jobId]: { ...prev[jobId], isPolling: false }
          }));
          
          toast({
            title: "Polling Stopped",
            description: `Stopped auto-checking job ${jobId.slice(-8)} due to repeated errors.`,
            variant: "destructive",
          });
          return;
        }

        // Retry in 1 minute
        intervalRefs.current[jobId] = setTimeout(() => {
          pollJob(currentPollCount + 1);
        }, getPollingInterval());
      }
    };

    // Start polling with 1-minute interval
    intervalRefs.current[jobId] = setTimeout(() => {
      pollJob(0);
    }, getPollingInterval());
  };

  // Manual refresh function - SINGLE REQUEST ONLY
  const manualRefresh = async (jobId: string) => {
    try {
      console.log(`[POLLING] Manual refresh for job ${jobId}`);
      const previousJob = jobs.find(j => j.id === jobId);
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
      
      // Check if job just completed during manual refresh
      if (updatedJob.status === 'completed' && previousJob?.status !== 'completed') {
        console.log(`[POLLING] Job ${jobId} completed during manual refresh - triggering auto-download`);
        if (onJobCompleted) {
          onJobCompleted(updatedJob);
        }
        toast({
          title: "Job Completed",
          description: `Job ${jobId.slice(-8)} completed. Downloading results...`,
        });
      } else {
        // Start 1-minute auto-polling after manual refresh if job is still in progress
        if (!pollingStates[jobId]?.isPolling && ['validating', 'in_progress', 'finalizing'].includes(updatedJob.status)) {
          startPolling(jobId);
        }
        
        toast({
          title: "Status Updated",
          description: `Job ${jobId.slice(-8)} status refreshed. Auto-checking every minute...`,
        });
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
      
      toast({
        title: "Manual Refresh Failed",
        description: `Failed to refresh job ${jobId.slice(-8)}: ${errorMessage}`,
        variant: "destructive",
      });
      
      throw error;
    }
  };

  // Stop polling for a specific job
  const stopPolling = (jobId: string) => {
    if (intervalRefs.current[jobId]) {
      clearInterval(intervalRefs.current[jobId]);
      delete intervalRefs.current[jobId];
    }
    
    setPollingStates(prev => ({
      ...prev,
      [jobId]: { ...prev[jobId], isPolling: false }
    }));
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanupPolling;
  }, []);

  return {
    pollingStates,
    startPolling,
    stopPolling,
    cleanupPolling,
    manualRefresh
  };
};
