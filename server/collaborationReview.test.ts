import { describe, expect, it } from "vitest";
import { buildOcrConfidenceChartData, ocrConfidenceManualReviewCopy } from "../client/src/lib/ocrConfidenceChart";
import { findPdfTextMatches } from "../client/src/lib/pdfPreview";

describe("collaborative review helpers", () => {
  it("orders OCR confidence points and clearly surfaces manual-review reasons", () => {
    const history = [{ confidence: "high" as const, concernCount: 0, createdAt: 30 }, { confidence: "low" as const, concernCount: 2, createdAt: 10 }, { confidence: "medium" as const, concernCount: 0, createdAt: 20 }];
    expect(buildOcrConfidenceChartData(history).map((point) => point.score)).toEqual([1, 2, 3]);
    expect(ocrConfidenceManualReviewCopy(true, history[1])).toContain("2 model concerns");
    expect(ocrConfidenceManualReviewCopy(false, history[0])).toContain("above the current manual-review threshold");
  });

  it("finds private PDF keyword matches by page, counts repeats, and limits scanning to the configured page bound", () => {
    const pages = [{ pageNumber: 1, text: "Income certificate income" }, { pageNumber: 2, text: "No matching phrase" }, { pageNumber: 3, text: "INCOME proof" }];
    expect(findPdfTextMatches(pages, "income")).toEqual([{ pageNumber: 1, count: 2 }, { pageNumber: 3, count: 1 }]);
    expect(findPdfTextMatches(pages, "income", 2)).toEqual([{ pageNumber: 1, count: 2 }]);
    expect(findPdfTextMatches(pages, "   ")).toEqual([]);
  });
});
