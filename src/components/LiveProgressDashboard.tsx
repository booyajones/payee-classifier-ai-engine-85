
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Clock, Zap, AlertTriangle } from "lucide-react";
import { useProcessing, ProcessingJob } from "@/contexts/ProcessingContext";

const LiveProgressDashboard = () => {
  const { activeJobs, pauseJob, resumeJob } = useProcessing();

  if (activeJobs.length === 0) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Live Processing Dashboard
          <Badge variant="outline">{activeJobs.length} Active Job{activeJobs.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeJobs.map((job) => {
          const progress = job.totalRows > 0 ? (job.processedRows / job.totalRows) * 100 : 0;
          const elapsedTime = (Date.now() - job.startTime) / 1000;
          const estimatedTotal = job.processingSpeed && job.processingSpeed > 0
            ? (job.totalRows / job.processingSpeed) * 60
            : 0;
          const remainingTime = job.eta ?? (estimatedTotal - elapsedTime);

          return (
            <div key={job.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">
                    {job.type === 'direct' ? 'Direct Processing' : 'Batch Job'} 
                    <span className="text-sm text-muted-foreground ml-2">
                      (ID: {job.id.slice(-8)})
                    </span>
                  </h4>
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  {job.status === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseJob(job.id)}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {job.status === 'paused' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resumeJob(job.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress: {job.processedRows} / {job.totalRows} rows</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Queued: {job.queued ?? 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Running: {job.running ?? 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Failed: {job.failed ?? 0}</span>
                </div>
              </div>

              {job.status === 'running' && remainingTime > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Estimated time remaining: {formatTime(remainingTime)}
                  </span>
                </div>
              )}

              {job.errorCount > 0 && (
                <div className="flex items-center gap-1 text-sm text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>
                    {job.errorCount} processing error{job.errorCount !== 1 ? 's' : ''} detected
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default LiveProgressDashboard;
