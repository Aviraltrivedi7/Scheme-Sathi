import { describe, expect, it } from "vitest";
import { clampPdfPage, clampPdfZoom, findPdfHighlightRects, nextPdfRotation } from "../client/src/lib/pdfPreview";

describe("PDF page navigation bounds", () => {
  it("keeps a signed preview on valid first, middle, and last page positions", () => {
    expect(clampPdfPage(-4, 6)).toBe(1);
    expect(clampPdfPage(3, 6)).toBe(3);
    expect(clampPdfPage(99, 6)).toBe(6);
    expect(clampPdfPage(2, 0)).toBe(1);
  });

  it("bounds zoom and advances rotation predictably for a readable expanded preview", () => {
    expect(clampPdfZoom(0.1)).toBe(0.7);
    expect(clampPdfZoom(1.35)).toBe(1.35);
    expect(clampPdfZoom(9)).toBe(2);
    expect(nextPdfRotation(0)).toBe(90);
    expect(nextPdfRotation(270)).toBe(0);
  });

  it("returns bounded highlight geometry only for matching PDF text items", () => {
    const items = [{ str: "Income Certificate", transform: [1, 0, 0, 12, 20, 80], width: 90, height: 12 }, { str: "Other", transform: [1, 0, 0, 12, 10, 30], width: 40, height: 12 }];
    expect(findPdfHighlightRects(items, "income", 200, 100)).toEqual([{ left: 10, top: 8, width: 45, height: 12 }]);
    expect(findPdfHighlightRects(items, "missing", 200, 100)).toEqual([]);
    expect(findPdfHighlightRects(items, "income", 0, 100)).toEqual([]);
  });
});
