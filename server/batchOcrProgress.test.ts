import { describe, expect, it } from "vitest";
import { batchOcrPercent, batchOcrSummary, createBatchOcrProgress, finishBatchOcrItem, startBatchOcrItem } from "../client/src/lib/batchOcrProgress";

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
});
