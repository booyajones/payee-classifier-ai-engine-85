import { updateBatchStatus } from "@/api/server";

export interface WorkerProgress {
  rowsDone: number;
  queued: number;
  running: number;
  failed: number;
  lowConfidence: number;
  duplicatesFound: number;
  etaSeconds: number | null;
}

/**
 * Report batch processing progress back to the server.
 * Workers should call this function whenever their counters change.
 */
export function reportProgress(id: string, progress: WorkerProgress) {
  updateBatchStatus(id, {
    rows_done: progress.rowsDone,
    queued: progress.queued,
    running: progress.running,
    failed: progress.failed,
    low_confidence: progress.lowConfidence,
    duplicates_found: progress.duplicatesFound,
    eta_seconds: progress.etaSeconds,
  });
}
