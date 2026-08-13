import { describe, expect, it } from "vitest";
import { buildManualReviewPriorityQueue } from "../client/src/lib/manualReviewPriority";

describe("manual review priority queue", () => {
  it("prioritizes lower confidence, model concerns, and worsening trends without changing server review eligibility", () => {
    const queue = buildManualReviewPriorityQueue([{ documentId: 1, documentName: "Income", fileName: "income.pdf", schemeName: "Scholarship", confidence: "medium", concernCount: 0, trend: "steady", updatedAt: 20 }, { documentId: 2, documentName: "Identity", fileName: "id.pdf", schemeName: "Scholarship", confidence: "low", concernCount: 2, trend: "lower", updatedAt: 10 }]);
    expect(queue.map((item) => item.documentId)).toEqual([2, 1]);
    expect(queue[0].reasons).toEqual(["low confidence", "2 concerns", "confidence trending lower"]);
  });
});
