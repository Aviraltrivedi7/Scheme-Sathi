import type { OcrConfidence } from "./ocrPolicy";

export type OcrConfidenceSnapshot = { confidence: OcrConfidence; concernCount: number; createdAt: number };
const rank: Record<OcrConfidence, number> = { low: 0, medium: 1, high: 2 };

export function summariseOcrConfidenceTrend(history: OcrConfidenceSnapshot[]) {
  const ordered = [...history].sort((a, b) => b.createdAt - a.createdAt);
  const current = ordered[0];
  if (!current) return null;
  const previous = ordered[1];
  if (!previous) return { direction: "baseline" as const, label: `OCR confidence baseline: ${current.confidence}.`, createdAt: current.createdAt };
  const delta = rank[current.confidence] - rank[previous.confidence];
  const direction = delta > 0 ? "improving" : delta < 0 ? "lower" : "steady";
  const concernNote = current.concernCount ? ` ${current.concernCount} concern${current.concernCount === 1 ? "" : "s"} noted.` : " No concerns noted.";
  return { direction, label: `OCR confidence trend: ${direction} (${previous.confidence} → ${current.confidence}).${concernNote}`, createdAt: current.createdAt };
}

export function shouldResetOcrConfidenceHistory(isReupload: boolean) { return isReupload; }
