import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type VerificationHistoryEvent = { documentId?: number; documentName: string; fileName: string; mimeType?: string; schemeName: string; kind: string; detail: string | null; createdAt: number };

export const verificationHistoryLabels: Record<string, string> = { uploaded: "Document uploaded", reuploaded: "Fresh copy uploaded", expiryUpdated: "Expiry date updated", ocrStarted: "OCR started", ocrCompleted: "OCR details extracted", ocrFailed: "OCR needs attention", userVerified: "User verified details", reviewed: "Marked reviewed", flagged: "Flagged for inspection" };

export function filterVerificationHistory(events: VerificationHistoryEvent[], filters?: { startAt?: number; endAt?: number; sort?: "newest" | "oldest"; query?: string }) {
  const query = filters?.query?.trim().toLocaleLowerCase();
  return events.filter((event) => (!filters?.startAt || event.createdAt >= filters.startAt) && (!filters?.endAt || event.createdAt <= filters.endAt) && (!query || [event.documentName, event.fileName, event.schemeName, verificationHistoryLabels[event.kind] ?? event.kind, event.detail ?? ""].join(" ").toLocaleLowerCase().includes(query))).sort((a, b) => filters?.sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
}

export async function createVerificationHistoryPdf(events: VerificationHistoryEvent[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const draw = (text: string, size = 9, isBold = false, color = rgb(0.13, 0.19, 0.29)) => { if (y < 56) { page = pdf.addPage([595, 842]); y = 800; } page.drawText(text.slice(0, 112), { x: 48, y, size, font: isBold ? bold : regular, color }); y -= size + 5; };
  draw("Scheme Sathi — Document Verification History", 18, true, rgb(0.07, 0.16, 0.28));
  draw(`Generated ${new Date().toLocaleString("en-IN")}`, 8, false, rgb(0.35, 0.39, 0.45));
  y -= 8;
  if (!events.length) draw("No verification activity matches the selected date range.", 10);
  for (const event of events) {
    draw(`${new Date(event.createdAt).toLocaleString("en-IN")}  ·  ${verificationHistoryLabels[event.kind] ?? event.kind}`, 10, true);
    draw(`${event.schemeName} — ${event.documentName} (${event.fileName})`, 9);
    if (event.detail) draw(event.detail, 8, false, rgb(0.35, 0.39, 0.45));
    y -= 5;
  }
  return pdf.save();
}
