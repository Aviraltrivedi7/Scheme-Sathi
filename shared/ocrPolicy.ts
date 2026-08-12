export type OcrConfidence = "low" | "medium" | "high";

const confidenceRank: Record<OcrConfidence, number> = { low: 1, medium: 2, high: 3 };

export function needsManualOcrReview(confidence: OcrConfidence, concerns: string[], minimumConfidence: OcrConfidence) {
  return concerns.length > 0 || confidenceRank[confidence] < confidenceRank[minimumConfidence];
}
