
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Clock, AlertTriangle, Zap, TrendingUp } from "lucide-react";
import { BatchJob } from "@/lib/openai/trueBatchAPI";
import { useProcessing } from "@/contexts/ProcessingContext";
import BatchJobTimeline from "./BatchJobTimeline";
import BatchJobActions from "./BatchJobActions";

interface PollingState {
  isPolling: boolean;
  pollCount: number;
  lastError?: string;
  lastSuccessfulPoll?: number;
  isRateLimited?: boolean;
  consecutiveFailures?: number;
}

interface EnhancedBatchJobCardProps {
  job: BatchJob;
  pollingState?: PollingState;
  payeeCount: number;
  isRefreshing: boolean;
  isDownloading: boolean;
  onManualRefresh: (jobId: string) => void;
  onDownloadResults: (job: BatchJob) => void;
  onCancelJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
}

const EnhancedBatchJobCard = ({
  job,
  pollingState,
  payeeCount,
  isRefreshing,
  isDownloading,
  onManualRefresh,
  onDownloadResults,
  onCancelJob,
  onDeleteJob
}: EnhancedBatchJobCardProps) => {
  const { activeJobs } = useProcessing();
  
  // Check if this job is currently being processed locally
  const activeJob = activeJobs.find(activeJob => activeJob.id.includes(job.id.slice(-8)));
  
  const formatLastPollTime = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) return `${minutes}m ${seconds}s ago`;
    return `${seconds}s ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'expired':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'expired':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const calculateProgress = () => {
    if (activeJob) {
      return activeJob.totalRows > 0 ? (activeJob.processedRows / activeJob.totalRows) * 100 : 0;
    }
    // For batch API jobs, use the request counts
    return job.request_counts.total > 0 ? (job.request_counts.completed / job.request_counts.total) * 100 : 0;
  };

  const progress = calculateProgress();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              Job {job.id.slice(-8)}
              {pollingState?.isPolling && (
                <span className="text-xs text-blue-600">
                  (Auto-checking)
                </span>
              )}
              {activeJob && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Live Processing
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {job.metadata?.description || 'Payee classification batch'} • {payeeCount} payees
            </CardDescription>
            
            {/* Enhanced Progress Section */}
            {(activeJob || ['in_progress', 'validating', 'finalizing'].includes(job.status)) && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {activeJob 
                      ? `${activeJob.processedRows} / ${activeJob.totalRows} processed`
                      : `${job.request_counts.completed} / ${job.request_counts.total} requests`
                    }
                  </span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                
                {activeJob && (
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      AI: {activeJob.aiProcessedCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      Excluded: {activeJob.excludedCount}
                    </span>
                    {activeJob.errorCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        Errors: {activeJob.errorCount}
                      </span>
                    )}
                    {activeJob.processingSpeed && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {activeJob.processingSpeed.toFixed(1)} rows/min
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {pollingState?.lastError && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <p className="text-xs text-red-600">
                  {pollingState.lastError}
                </p>
              </div>
            )}
            {pollingState?.lastSuccessfulPoll && (
              <p className="text-xs text-muted-foreground mt-1">
                Last checked: {formatLastPollTime(pollingState.lastSuccessfulPoll)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(job.status)}
            <Badge className={getStatusColor(job.status)}>
              {job.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <BatchJobTimeline job={job} />
        
        {/* Enhanced Stats Section */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Total Requests:</span> {job.request_counts.total}
          </div>
          <div>
            <span className="font-medium">Completed:</span> {job.request_counts.completed}
          </div>
          <div>
            <span className="font-medium">Failed:</span> {job.request_counts.failed}
          </div>
          <div>
            <span className="font-medium">Success Rate:</span>{' '}
            {job.request_counts.total > 0 
              ? `${Math.round(((job.request_counts.completed - job.request_counts.failed) / job.request_counts.total) * 100)}%`
              : '0%'
            }
          </div>
        </div>
        
        <BatchJobActions
          job={job}
          isRefreshing={isRefreshing}
          isDownloading={isDownloading}
          onManualRefresh={onManualRefresh}
          onDownloadResults={onDownloadResults}
          onCancelJob={onCancelJob}
          onDeleteJob={onDeleteJob}
        />
      </CardContent>
    </Card>
  );
};

export default EnhancedBatchJobCard;
