import { describe, expect, it } from "vitest";
import { createVerificationHistoryCsv } from "./verificationHistoryCsv";

describe("verification history CSV export", () => {
  it("keeps filtered activity, OCR data and review state while escaping commas, quotes and spreadsheet formulas", () => {
    const csv = createVerificationHistoryCsv([{ documentId: 8, documentName: 'Income "certificate"', fileName: "income,2026.pdf", schemeName: "=SCHOLARSHIP", kind: "flagged", detail: 'Needs "manual", inspection', createdAt: Date.UTC(2026, 0, 2) }], new Map([[8, { ocrStatus: "complete", ocrExtraction: { confidence: "medium", documentType: "Income certificate", detectedName: "Asha", concerns: ["Image unclear", "Date incomplete"] }, reviewState: "flagged" }]]));
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain('"\'=SCHOLARSHIP"');
    expect(csv).toContain('"Income ""certificate"""');
    expect(csv).toContain('"income,2026.pdf"');
    expect(csv).toContain('"Needs ""manual"", inspection"');
    expect(csv).toContain('"Image unclear | Date incomplete"');
    expect(csv).toContain('"flagged"');
  });
});
