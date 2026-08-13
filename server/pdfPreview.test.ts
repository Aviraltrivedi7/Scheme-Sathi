import { describe, expect, it } from "vitest";
import { clampPdfPage } from "../client/src/lib/pdfPreview";

describe("PDF page navigation bounds", () => {
  it("keeps a signed preview on valid first, middle, and last page positions", () => {
    expect(clampPdfPage(-4, 6)).toBe(1);
    expect(clampPdfPage(3, 6)).toBe(3);
    expect(clampPdfPage(99, 6)).toBe(6);
    expect(clampPdfPage(2, 0)).toBe(1);
  });
});
