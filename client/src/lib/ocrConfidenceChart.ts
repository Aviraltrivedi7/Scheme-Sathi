export type ConfidenceSnapshot = { confidence: "low" | "medium" | "high"; concernCount: number; createdAt: number };

const score = { low: 1, medium: 2, high: 3 } as const;

export function buildOcrConfidenceChartData(history: ConfidenceSnapshot[]) {
  return [...history].sort((a, b) => a.createdAt - b.createdAt).map((point, index) => ({ index: index + 1, score: score[point.confidence], confidence: point.confidence, concernCount: point.concernCount, createdAt: point.createdAt }));
}

export function ocrConfidenceManualReviewCopy(needsManualReview: boolean, latest?: ConfidenceSnapshot) {
  if (!latest) return "Confidence history will appear after OCR completes.";
  if (needsManualReview) return latest.concernCount ? `Manual review required: ${latest.concernCount} model concern${latest.concernCount === 1 ? "" : "s"} in the latest extraction.` : "Manual review required under the current confidence policy.";
  return "Latest extraction is above the current manual-review threshold.";
}
