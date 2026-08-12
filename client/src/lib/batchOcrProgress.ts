export type BatchOcrItem = { documentId: number; documentName: string };
export type BatchOcrItemState = "queued" | "running" | "complete" | "failed" | "cancelled";
export type BatchOcrProgress = { total: number; completed: number; succeeded: number; failed: number; cancelled: number; runningDocumentId: number | null; items: Record<number, { state: BatchOcrItemState; message: string }> };

export function createBatchOcrProgress(items: BatchOcrItem[]): BatchOcrProgress {
  return { total: items.length, completed: 0, succeeded: 0, failed: 0, cancelled: 0, runningDocumentId: null, items: Object.fromEntries(items.map((item) => [item.documentId, { state: "queued", message: "Waiting to start." }])) };
}

export function startBatchOcrItem(progress: BatchOcrProgress, item: BatchOcrItem): BatchOcrProgress {
  return { ...progress, runningDocumentId: item.documentId, items: { ...progress.items, [item.documentId]: { state: "running", message: `Extracting ${item.documentName}…` } } };
}

export function finishBatchOcrItem(progress: BatchOcrProgress, documentId: number, ok: boolean, message?: string): BatchOcrProgress {
  return { ...progress, completed: progress.completed + 1, succeeded: progress.succeeded + (ok ? 1 : 0), failed: progress.failed + (ok ? 0 : 1), runningDocumentId: null, items: { ...progress.items, [documentId]: { state: ok ? "complete" : "failed", message: message ?? (ok ? "OCR details extracted. Review before approval." : "OCR could not complete. Retry or review manually.") } } };
}

export function cancelQueuedBatchOcrItems(progress: BatchOcrProgress): BatchOcrProgress {
  const queuedIds = Object.entries(progress.items).filter(([, item]) => item.state === "queued").map(([documentId]) => Number(documentId));
  if (!queuedIds.length) return progress;
  return { ...progress, completed: progress.completed + queuedIds.length, cancelled: progress.cancelled + queuedIds.length, items: { ...progress.items, ...Object.fromEntries(queuedIds.map((documentId) => [documentId, { state: "cancelled", message: "Cancelled before OCR started." }])) } };
}

export function reorderBatchOcrQueue(documentIds: number[], movingId: number, targetId: number) {
  if (movingId === targetId || !documentIds.includes(movingId) || !documentIds.includes(targetId)) return documentIds;
  const withoutMoving = documentIds.filter((documentId) => documentId !== movingId);
  const targetIndex = withoutMoving.indexOf(targetId);
  return [...withoutMoving.slice(0, targetIndex), movingId, ...withoutMoving.slice(targetIndex)];
}

export function batchOcrPercent(progress: BatchOcrProgress) { return progress.total ? Math.round((progress.completed / progress.total) * 100) : 0; }

export function batchOcrSummary(progress: BatchOcrProgress) {
  if (!progress.total) return "No documents selected.";
  if (progress.completed < progress.total) return `Extracting ${progress.completed + 1} of ${progress.total} documents.`;
  const outcomes = [`${progress.succeeded} of ${progress.total} documents extracted`];
  if (progress.failed) outcomes.push(`${progress.failed} need retry or manual review`);
  if (progress.cancelled) outcomes.push(`${progress.cancelled} cancelled before processing`);
  return `${outcomes.join("; ")}.`;
}
