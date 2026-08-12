import { describe, expect, it } from "vitest";
import { needsManualOcrReview } from "@shared/ocrPolicy";

describe("server-side OCR confidence policy", () => {
  it("flags confidence lower than the configured threshold", () => {
    expect(needsManualOcrReview("medium", [], "high")).toBe(true);
    expect(needsManualOcrReview("high", [], "high")).toBe(false);
  });

  it("always flags model concerns irrespective of the confidence threshold", () => {
    expect(needsManualOcrReview("high", ["Unreadable signature"], "low")).toBe(true);
  });
});
