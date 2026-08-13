import { describe, expect, it } from "vitest";
import { shouldResetOcrConfidenceHistory, summariseOcrConfidenceTrend } from "../shared/ocrConfidenceTrend";

describe("OCR confidence trend", () => {
  it("explains baseline, improving, lower, and concern-aware trends from actual confidence snapshots", () => {
    expect(summariseOcrConfidenceTrend([{ confidence: "medium", concernCount: 0, createdAt: 2 }])).toMatchObject({ direction: "baseline", label: "OCR confidence baseline: medium." });
    expect(summariseOcrConfidenceTrend([{ confidence: "high", concernCount: 0, createdAt: 20 }, { confidence: "low", concernCount: 2, createdAt: 10 }])).toMatchObject({ direction: "improving", label: "OCR confidence trend: improving (low → high). No concerns noted." });
    expect(summariseOcrConfidenceTrend([{ confidence: "low", concernCount: 2, createdAt: 20 }, { confidence: "high", concernCount: 0, createdAt: 10 }])).toMatchObject({ direction: "lower", label: "OCR confidence trend: lower (high → low). 2 concerns noted." });
  });

  it("starts a clean confidence series when a fresh file replaces an existing checklist document", () => {
    expect(shouldResetOcrConfidenceHistory(false)).toBe(false);
    expect(shouldResetOcrConfidenceHistory(true)).toBe(true);
  });
});
