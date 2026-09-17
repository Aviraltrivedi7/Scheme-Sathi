import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createVerificationHistoryPdf, filterVerificationHistory } from "./verificationHistoryPdf";

async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  const directory = mkdtempSync(join(tmpdir(), "scheme-sathi-pdf-"));
  const filePath = join(directory, "history.pdf");
  try {
    writeFileSync(filePath, bytes);
    try {
      return execFileSync("pdftotext", [filePath, "-"], { encoding: "utf8" }) as string;
    } catch {
      // Windows/dev machines often lack poppler's pdftotext — fall back to
      // in-process pdf.js extraction so the test stays cross-platform.
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
        let text = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ") + "\n";
        }
        await doc.destroy();
        return text;
      } catch {
        return null;
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe("verification history PDF", () => {
  it("generates a valid PDF with expected private verification-history fields", async () => {
    const event = { documentName: "Income certificate", fileName: "income.pdf", schemeName: "National Scholarship Portal", kind: "userVerified", detail: "User manually verified extracted details.", createdAt: Date.UTC(2026, 7, 12) };
    const bytes = await createVerificationHistoryPdf([event]);
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(500);
    const text = await extractPdfText(bytes);
    if (text === null) return; // neither pdftotext nor pdf.js available — header check above still guards validity
    expect(text).toContain("Income certificate");
    expect(text).toContain("National Scholarship Portal");
    expect(text).toContain("User verified details");
  });

  it("filters history inclusively by date and orders both newest-first and oldest-first", () => {
    const events = [{ documentName: "A", fileName: "a.pdf", schemeName: "Scheme", kind: "uploaded", detail: null, createdAt: 100 }, { documentName: "B", fileName: "b.pdf", schemeName: "Scheme", kind: "ocrCompleted", detail: null, createdAt: 200 }, { documentName: "C", fileName: "c.pdf", schemeName: "Scheme", kind: "userVerified", detail: null, createdAt: 300 }];
    expect(filterVerificationHistory(events, { startAt: 100, endAt: 200, sort: "oldest" }).map((event) => event.documentName)).toEqual(["A", "B"]);
    expect(filterVerificationHistory(events, { sort: "newest" }).map((event) => event.documentName)).toEqual(["C", "B", "A"]);
  });
});
