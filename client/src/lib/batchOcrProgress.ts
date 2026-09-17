export type BatchOcrItem = { documentId: number; documentName: string };
export type BatchOcrItemState = "queued" | "running" | "complete" | "failed" | "cancelled";
export type BatchOcrProgress = { total: number; completed: number; succeeded: number; failed: number; cancelled: number; runningDocumentId: number | null; activeStartedAt: number | null; completedDurationsMs: number[]; items: Record<number, { state: BatchOcrItemState; message: string }> };

export function createBatchOcrProgress(items: BatchOcrItem[], startedAt = Date.now()): BatchOcrProgress {
  return { total: items.length, completed: 0, succeeded: 0, failed: 0, cancelled: 0, runningDocumentId: null, activeStartedAt: null, completedDurationsMs: [], items: Object.fromEntries(items.map((item) => [item.documentId, { state: "queued", message: "Waiting to start." }])) };
}

export function startBatchOcrItem(progress: BatchOcrProgress, item: BatchOcrItem, startedAt = Date.now()): BatchOcrProgress {
  return { ...progress, runningDocumentId: item.documentId, activeStartedAt: startedAt, items: { ...progress.items, [item.documentId]: { state: "running", message: `Extracting ${item.documentName}…` } } };
}

export function finishBatchOcrItem(progress: BatchOcrProgress, documentId: number, ok: boolean, message?: string, finishedAt = Date.now()): BatchOcrProgress {
  const duration = progress.activeStartedAt ? Math.max(1, finishedAt - progress.activeStartedAt) : 0;
  return { ...progress, completed: progress.completed + 1, succeeded: progress.succeeded + (ok ? 1 : 0), failed: progress.failed + (ok ? 0 : 1), runningDocumentId: null, activeStartedAt: null, completedDurationsMs: duration ? [...progress.completedDurationsMs, duration] : progress.completedDurationsMs, items: { ...progress.items, [documentId]: { state: ok ? "complete" : "failed", message: message ?? (ok ? "OCR details extracted. Review before approval." : "OCR could not complete. Retry or review manually.") } } };
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

export function estimateBatchOcrRemainingMs(progress: BatchOcrProgress, now = Date.now()) {
  if (!progress.completedDurationsMs.length || progress.completed >= progress.total) return null;
  const averageMs = progress.completedDurationsMs.reduce((total, duration) => total + duration, 0) / progress.completedDurationsMs.length;
  const remainingWork = progress.total - progress.completed;
  const activeElapsed = progress.activeStartedAt ? Math.max(0, now - progress.activeStartedAt) : 0;
  return Math.max(0, Math.round(averageMs * remainingWork - activeElapsed));
}

export function formatBatchOcrEta(remainingMs: number | null) {
  if (remainingMs === null) return "Estimating after the first document.";
  if (remainingMs < 60_000) return "About less than a minute remaining.";
  return `About ${Math.ceil(remainingMs / 60_000)} min remaining.`;
}

export function batchOcrSummary(progress: BatchOcrProgress, now = Date.now()) {
  if (!progress.total) return "No documents selected.";
  if (progress.completed < progress.total) return `Extracting ${progress.completed + 1} of ${progress.total} documents. ${formatBatchOcrEta(estimateBatchOcrRemainingMs(progress, now))}`;
  const outcomes = [`${progress.succeeded} of ${progress.total} documents extracted`];
  if (progress.failed) outcomes.push(`${progress.failed} need retry or manual review`);
  if (progress.cancelled) outcomes.push(`${progress.cancelled} cancelled before processing`);
  return `${outcomes.join("; ")}.`;
}
