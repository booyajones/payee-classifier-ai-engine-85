
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Trash, Loader2 } from "lucide-react";
import { BatchJob } from "@/lib/openai/trueBatchAPI";

interface BatchJobActionsProps {
  job: BatchJob;
  isRefreshing: boolean;
  isDownloading: boolean;
  onManualRefresh: (jobId: string) => void;
  onDownloadResults: (job: BatchJob) => void;
  onCancelJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
}

const BatchJobActions = ({
  job,
  isRefreshing,
  isDownloading,
  onManualRefresh,
  onDownloadResults,
  onCancelJob,
  onDeleteJob
}: BatchJobActionsProps) => {
  // Jobs that can be cancelled (only in progress states, not already cancelling)
  const canCancel = ['validating', 'in_progress', 'finalizing'].includes(job.status);
  
  // Jobs that can be deleted/removed (finished states including cancelled and cancelling)
  const canDelete = ['completed', 'failed', 'expired', 'cancelled', 'cancelling'].includes(job.status);
  
  // Jobs that can be downloaded
  const canDownload = job.status === 'completed';

  console.log(`[BATCH ACTIONS] Job ${job.id.slice(-8)} - Status: ${job.status}, canDelete: ${canDelete}, canCancel: ${canCancel}`);

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Manual Refresh Button - always available */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onManualRefresh(job.id)}
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3 mr-1" />
        )}
        {isRefreshing ? 'Checking...' : 'Check Status'}
      </Button>

      {/* Download Results Button - only for completed jobs */}
      {canDownload && (
        <Button
          size="sm"
          onClick={() => onDownloadResults(job)}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Download className="h-3 w-3 mr-1" />
          )}
          {isDownloading ? 'Downloading...' : 'Download Results'}
        </Button>
      )}

      {/* Cancel Job Button - only for jobs that can be cancelled */}
      {canCancel && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onCancelJob(job.id)}
        >
          Cancel Job
        </Button>
      )}

      {/* Delete/Remove Button - for finished jobs including cancelled and cancelling */}
      {canDelete && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDeleteJob(job.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash className="h-3 w-3 mr-1" />
          Remove
        </Button>
      )}
    </div>
  );
};

export default BatchJobActions;
