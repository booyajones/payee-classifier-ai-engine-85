import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { PayeeClassification, ClassificationResult, BatchProcessingResult } from "@/lib/types"
import { exportResultsWithOriginalDataV3 } from "@/lib/classification/exporters"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createPayeeClassification(
  payeeName: string, 
  result: ClassificationResult,
  originalData?: any,
  rowIndex?: number
): PayeeClassification {
  return {
    id: `payee-${Date.now()}-${crypto.randomUUID()}`,
    payeeName,
    result,
    timestamp: new Date(),
    originalData, // Include original row data
    rowIndex // Include row index for proper ordering
  };
}

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const downloadCSV = (results: PayeeClassification[]) => {
  if (results.length === 0) return;

  const summary: BatchProcessingResult = {
    results,
    successCount: results.filter(r => r.result.processingTier !== 'Failed').length,
    failureCount: results.filter(r => r.result.processingTier === 'Failed').length,
    originalFileData: results.map(r => r.originalData)
  };

  const exportRows = exportResultsWithOriginalDataV3(summary, true);

  const headers = Object.keys(exportRows[0]);
  const csvLines = [
    headers.join(','),
    ...exportRows.map(row =>
      headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    )
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'classification-results.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadJSON = (results: PayeeClassification[]) => {
  const json = JSON.stringify(results, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'classification-results.json';
  a.click();
  URL.revokeObjectURL(url);
};
