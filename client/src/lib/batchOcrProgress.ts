export type BatchOcrItem = { documentId: number; documentName: string };
export type BatchOcrItemState = "queued" | "running" | "complete" | "failed";
export type BatchOcrProgress = { total: number; completed: number; succeeded: number; failed: number; runningDocumentId: number | null; items: Record<number, { state: BatchOcrItemState; message: string }> };

export function createBatchOcrProgress(items: BatchOcrItem[]): BatchOcrProgress {
  return { total: items.length, completed: 0, succeeded: 0, failed: 0, runningDocumentId: null, items: Object.fromEntries(items.map((item) => [item.documentId, { state: "queued", message: "Waiting to start." }])) };
}

export function startBatchOcrItem(progress: BatchOcrProgress, item: BatchOcrItem): BatchOcrProgress {
  return { ...progress, runningDocumentId: item.documentId, items: { ...progress.items, [item.documentId]: { state: "running", message: `Extracting ${item.documentName}…` } } };
}

export function finishBatchOcrItem(progress: BatchOcrProgress, documentId: number, ok: boolean, message?: string): BatchOcrProgress {
  return { ...progress, completed: progress.completed + 1, succeeded: progress.succeeded + (ok ? 1 : 0), failed: progress.failed + (ok ? 0 : 1), runningDocumentId: null, items: { ...progress.items, [documentId]: { state: ok ? "complete" : "failed", message: message ?? (ok ? "OCR details extracted. Review before approval." : "OCR could not complete. Retry or review manually.") } } };
}

export function batchOcrPercent(progress: BatchOcrProgress) { return progress.total ? Math.round((progress.completed / progress.total) * 100) : 0; }

export function batchOcrSummary(progress: BatchOcrProgress) {
  if (!progress.total) return "No documents selected.";
  if (progress.completed < progress.total) return `Extracting ${progress.completed + 1} of ${progress.total} documents.`;
  return `${progress.succeeded} of ${progress.total} documents extracted${progress.failed ? `; ${progress.failed} need retry or manual review.` : "."}`;
}
