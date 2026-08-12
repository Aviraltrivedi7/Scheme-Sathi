export type VerificationHistorySearchEvent = {
  documentName: string;
  fileName: string;
  schemeName: string;
  kind: string;
  detail: string | null;
};

export const verificationHistoryLabels: Record<string, string> = {
  uploaded: "Document uploaded",
  reuploaded: "Fresh copy uploaded",
  expiryUpdated: "Expiry date updated",
  ocrStarted: "OCR started",
  ocrCompleted: "OCR details extracted",
  ocrFailed: "OCR needs attention",
  userVerified: "User verified details",
};

export function filterVerificationHistoryByQuery<T extends VerificationHistorySearchEvent>(events: T[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return events;
  return events.filter((event) => [event.documentName, event.fileName, event.schemeName, verificationHistoryLabels[event.kind] ?? event.kind, event.detail ?? ""].join(" ").toLocaleLowerCase().includes(normalizedQuery));
}

export function historyPreviewFeedback(state: "loading" | "unavailable") {
  return state === "loading" ? "Loading secure preview…" : "Preview unavailable. Try the full preview from your checklist.";
}
