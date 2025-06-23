
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, Trash2, Eye, History } from 'lucide-react';
import { StoredBatchResult, getProcessingHistory, deleteResult } from '@/lib/storage/resultStorage';
import { exportResultsFixed } from '@/lib/classification/fixedExporter';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ProcessingHistoryProps {
  onResultSelect?: (result: StoredBatchResult) => void;
}

const ProcessingHistory = ({ onResultSelect }: ProcessingHistoryProps) => {
  const [history, setHistory] = useState<StoredBatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const results = await getProcessingHistory();
      setHistory(results);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast({
        title: "Error",
        description: "Failed to load processing history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await deleteResult(id);
      setHistory(prev => prev.filter(r => r.id !== id));
      toast({
        title: "Success",
        description: "Processing result deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete result",
        variant: "destructive"
      });
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleExport = async (result: StoredBatchResult) => {
    try {
      await exportResultsFixed(result.classifications, result.summary);
      toast({
        title: "Success",
        description: "Results exported successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export results",
        variant: "destructive"
      });
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading history...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Processing History
          <Badge variant="outline">{history.length} Results</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 ? (
          <Alert>
            <AlertDescription>
              No processing history found. Results will appear here after you complete batch processing.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {history.map((result) => (
              <div key={result.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.job_type === 'batch' ? 'default' : 'secondary'}>
                        {result.job_type === 'batch' ? 'Batch API' : 'Direct Processing'}
                      </Badge>
                      {result.job_id && (
                        <span className="text-sm text-muted-foreground">
                          Job: {result.job_id.slice(-8)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {onResultSelect && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onResultSelect(result)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExport(result)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(result.id)}
                      disabled={deletingIds.has(result.id)}
                    >
                      {deletingIds.has(result.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total:</span> {result.total_payees}
                  </div>
                  <div>
                    <span className="font-medium">Business:</span> {result.business_count}
                  </div>
                  <div>
                    <span className="font-medium">Individual:</span> {result.individual_count}
                  </div>
                  <div>
                    <span className="font-medium">Processing Time:</span> {formatDuration(result.processing_time_ms)}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>AI Processed: {result.ai_processed_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Excluded: {result.excluded_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Errors: {result.error_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcessingHistory;
