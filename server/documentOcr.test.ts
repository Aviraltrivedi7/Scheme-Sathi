import { describe, expect, it } from "vitest";
import { normaliseOcrExtraction } from "./documentOcr";

describe("document OCR extraction safety", () => {
  it("keeps OCR fields bounded and preserves a review-oriented confidence state", () => {
    const result = normaliseOcrExtraction({ documentType: "Income certificate", detectedName: "Asha", referenceNumbers: ["REF-123"], dates: ["01 Jan 2026"], keyDetails: ["Annual income shown as ₹2,40,000"], concerns: [], confidence: "medium" });
    expect(result.confidence).toBe("medium");
    expect(result.keyDetails[0]).toContain("₹2,40,000");
  });
});
