import { verificationHistoryLabels, type VerificationHistoryEvent } from "./verificationHistoryPdf";

const escapeCsv = (value: unknown) => { const text = String(value ?? ""); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };

export function createVerificationHistoryCsv(events: VerificationHistoryEvent[], documentDetails: Map<number, { ocrStatus: string; ocrExtraction: { confidence: string; documentType: string; detectedName: string | null; concerns: string[] } | null; reviewState: string }>) {
  const header = ["Timestamp", "Scheme", "Document", "File name", "Activity", "Note", "OCR status", "OCR confidence", "OCR document type", "OCR detected name", "OCR concerns", "Review state"];
  const rows = events.map((event) => { const detail = event.documentId ? documentDetails.get(event.documentId) : undefined; return [new Date(event.createdAt).toISOString(), event.schemeName, event.documentName, event.fileName, verificationHistoryLabels[event.kind] ?? event.kind, event.detail ?? "", detail?.ocrStatus ?? "", detail?.ocrExtraction?.confidence ?? "", detail?.ocrExtraction?.documentType ?? "", detail?.ocrExtraction?.detectedName ?? "", detail?.ocrExtraction?.concerns.join(" | ") ?? "", detail?.reviewState ?? ""]; });
  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
