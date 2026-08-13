import { describe, expect, it } from "vitest";
import { batchOcrPercent, batchOcrSummary, cancelQueuedBatchOcrItems, createBatchOcrProgress, estimateBatchOcrRemainingMs, finishBatchOcrItem, formatBatchOcrEta, reorderBatchOcrQueue, startBatchOcrItem } from "../client/src/lib/batchOcrProgress";

describe("batch OCR progress", () => {
  it("tracks queued, active, complete, and failed document outcomes with clear totals", () => {
    const items = [{ documentId: 7, documentName: "Income certificate" }, { documentId: 8, documentName: "Identity proof" }];
    let progress = createBatchOcrProgress(items);
    expect(batchOcrPercent(progress)).toBe(0);
    progress = startBatchOcrItem(progress, items[0]);
    expect(progress.items[7]).toMatchObject({ state: "running", message: "Extracting Income certificate…" });
    progress = finishBatchOcrItem(progress, 7, true);
    progress = startBatchOcrItem(progress, items[1]);
    progress = finishBatchOcrItem(progress, 8, false, "Image was unreadable.");
    expect(batchOcrPercent(progress)).toBe(100);
    expect(progress).toMatchObject({ completed: 2, succeeded: 1, failed: 1, runningDocumentId: null });
    expect(progress.items[8]).toMatchObject({ state: "failed", message: "Image was unreadable." });
    expect(batchOcrSummary(progress)).toBe("1 of 2 documents extracted; 1 need retry or manual review.");
  });

  it("cancels only queued files while preserving the completed result and retryable cancelled state", () => {
    const items = [{ documentId: 7, documentName: "Income certificate" }, { documentId: 8, documentName: "Identity proof" }, { documentId: 9, documentName: "Address proof" }];
    let progress = createBatchOcrProgress(items);
    progress = startBatchOcrItem(progress, items[0]);
    progress = finishBatchOcrItem(progress, 7, true);
    progress = cancelQueuedBatchOcrItems(progress);
    expect(progress).toMatchObject({ completed: 3, succeeded: 1, failed: 0, cancelled: 2, runningDocumentId: null });
    expect(progress.items[8]).toMatchObject({ state: "cancelled", message: "Cancelled before OCR started." });
    expect(batchOcrPercent(progress)).toBe(100);
    expect(batchOcrSummary(progress)).toBe("1 of 3 documents extracted; 2 cancelled before processing.");
  });

  it("moves a selected document ahead of another without changing unrelated queue entries", () => {
    expect(reorderBatchOcrQueue([7, 8, 9], 9, 7)).toEqual([9, 7, 8]);
    expect(reorderBatchOcrQueue([7, 8, 9], 7, 9)).toEqual([8, 7, 9]);
    expect(reorderBatchOcrQueue([7, 8, 9], 7, 7)).toEqual([7, 8, 9]);
    expect(reorderBatchOcrQueue([7, 8, 9], 10, 7)).toEqual([7, 8, 9]);
  });

  it("derives a transparent ETA from observed completed OCR durations", () => {
    const items = [{ documentId: 7, documentName: "Income certificate" }, { documentId: 8, documentName: "Identity proof" }, { documentId: 9, documentName: "Address proof" }];
    let progress = createBatchOcrProgress(items);
    expect(formatBatchOcrEta(estimateBatchOcrRemainingMs(progress, 1_000))).toBe("Estimating after the first document.");
    progress = startBatchOcrItem(progress, items[0], 1_000);
    progress = finishBatchOcrItem(progress, 7, true, undefined, 31_000);
    progress = startBatchOcrItem(progress, items[1], 31_000);
    expect(estimateBatchOcrRemainingMs(progress, 36_000)).toBe(55_000);
    expect(formatBatchOcrEta(55_000)).toBe("About less than a minute remaining.");
  });
});
