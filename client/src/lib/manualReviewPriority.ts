export type ManualReviewCandidate = { documentId: number; documentName: string; fileName: string; schemeName: string; confidence: "low" | "medium" | "high" | null; concernCount: number; trend: "baseline" | "improving" | "steady" | "lower"; updatedAt: number };
const confidenceWeight = { low: 30, medium: 15, high: 5 } as const;

export function buildManualReviewPriorityQueue(candidates: ManualReviewCandidate[]) {
  return candidates.map((candidate) => { const score = (candidate.confidence ? confidenceWeight[candidate.confidence] : 20) + candidate.concernCount * 12 + (candidate.trend === "lower" ? 14 : candidate.trend === "baseline" ? 4 : 0); const reasons = [candidate.confidence === "low" ? "low confidence" : null, candidate.concernCount ? `${candidate.concernCount} concern${candidate.concernCount === 1 ? "" : "s"}` : null, candidate.trend === "lower" ? "confidence trending lower" : null].filter(Boolean) as string[]; return { ...candidate, score, reasons: reasons.length ? reasons : ["policy review required"] }; }).sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
}
