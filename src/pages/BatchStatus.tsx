import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface BatchProgress {
  rows_total: number;
  rows_done: number;
  queued: number;
  running: number;
  failed: number;
  low_confidence: number;
  duplicates_found: number;
  eta_seconds: number | null;
}

function useBatchStatus(id: string) {
  const [status, setStatus] = useState<BatchProgress | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/batches/${id}/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // ignore errors
      }
    };

    fetchStatus();
    timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [id]);

  return status;
}

export default function BatchStatus() {
  const { id = "" } = useParams<{ id: string }>();
  const status = useBatchStatus(id);

  if (!status) {
    return <div>Loading...</div>;
  }

  const progress = status.rows_total > 0 ? (status.rows_done / status.rows_total) * 100 : 0;
  const lowConfPct = status.rows_total > 0 ? (status.low_confidence / status.rows_total) * 100 : 0;
  const dupPct = status.rows_total > 0 ? (status.duplicates_found / status.rows_total) * 100 : 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Batch {id.slice(-8)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress: {status.rows_done} / {status.rows_total}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>Queued: {status.queued}</div>
            <div>Running: {status.running}</div>
            <div>Failed: {status.failed}</div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Low confidence: {status.low_confidence}</span>
              <span>{lowConfPct.toFixed(1)}%</span>
            </div>
            <Progress value={lowConfPct} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Duplicates: {status.duplicates_found}</span>
              <span>{dupPct.toFixed(1)}%</span>
            </div>
            <Progress value={dupPct} className="h-2" />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm">Review Low Confidence</Button>
            <Button variant="secondary" size="sm">Review Duplicates</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
