export type DocumentActivityKind = "uploaded" | "reuploaded" | "expiryUpdated" | "ocrStarted" | "ocrCompleted" | "ocrFailed" | "userVerified" | "reviewed" | "flagged";

export function buildDocumentActivityInsert(applicationDocumentId: number, kind: DocumentActivityKind, detail?: string) {
  return { applicationDocumentId, kind, detail: detail?.slice(0, 500) ?? null };
}

export function buildOcrApprovalUpdate(now: Date) {
  return { userVerifiedAt: now, updatedAt: now };
}

export function toDocumentTimeline<T extends { id: number; kind: DocumentActivityKind; detail: string | null; createdAt: Date }>(events: T[]) {
  return [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((event) => ({ id: event.id, kind: event.kind, detail: event.detail, createdAt: event.createdAt.getTime() }));
}
