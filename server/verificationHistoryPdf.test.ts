import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createVerificationHistoryPdf, filterVerificationHistory } from "./verificationHistoryPdf";

describe("verification history PDF", () => {
  it("generates a valid PDF with expected private verification-history fields", async () => {
    const event = { documentName: "Income certificate", fileName: "income.pdf", schemeName: "National Scholarship Portal", kind: "userVerified", detail: "User manually verified extracted details.", createdAt: Date.UTC(2026, 7, 12) };
    const bytes = await createVerificationHistoryPdf([event]);
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    const directory = mkdtempSync(join(tmpdir(), "scheme-sathi-pdf-"));
    const filePath = join(directory, "history.pdf");
    try {
      writeFileSync(filePath, bytes);
      const text = execFileSync("pdftotext", [filePath, "-"], { encoding: "utf8" });
      expect(text).toContain("Income certificate");
      expect(text).toContain("National Scholarship Portal");
      expect(text).toContain("User verified details");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("filters history inclusively by date and orders both newest-first and oldest-first", () => {
    const events = [{ documentName: "A", fileName: "a.pdf", schemeName: "Scheme", kind: "uploaded", detail: null, createdAt: 100 }, { documentName: "B", fileName: "b.pdf", schemeName: "Scheme", kind: "ocrCompleted", detail: null, createdAt: 200 }, { documentName: "C", fileName: "c.pdf", schemeName: "Scheme", kind: "userVerified", detail: null, createdAt: 300 }];
    expect(filterVerificationHistory(events, { startAt: 100, endAt: 200, sort: "oldest" }).map((event) => event.documentName)).toEqual(["A", "B"]);
    expect(filterVerificationHistory(events, { sort: "newest" }).map((event) => event.documentName)).toEqual(["C", "B", "A"]);
  });
});
