import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';

export interface BatchProgress {
  rows_total: number;
  rows_done: number;
  queued: number;
  running: number;
  failed: number;
  low_confidence: number;
  duplicates_found: number;
  eta_seconds: number | null;
}

const DEFAULT_STATUS: BatchProgress = {
  rows_total: 0,
  rows_done: 0,
  queued: 0,
  running: 0,
  failed: 0,
  low_confidence: 0,
  duplicates_found: 0,
  eta_seconds: null
};

const batchStatuses: Map<string, BatchProgress> = new Map();

function handler(req: IncomingMessage, res: ServerResponse) {
  const { pathname } = parse(req.url || '', true);
  const match = pathname?.match(/^\/api\/batches\/([^/]+)\/(status|progress)$/);

  if (req.method === 'GET' && match) {
    const id = match[1];
    const status = batchStatuses.get(id) || DEFAULT_STATUS;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(status));
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
}

export function updateBatchStatus(id: string, status: Partial<BatchProgress>) {
  const current = batchStatuses.get(id) || { ...DEFAULT_STATUS };
  batchStatuses.set(id, { ...current, ...status });
}

export function startServer(port = 3001) {
  const server = createServer(handler);
  server.listen(port);
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
