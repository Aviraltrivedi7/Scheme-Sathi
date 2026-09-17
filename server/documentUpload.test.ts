import { describe, expect, it } from "vitest";
import { safeStorageFileName, validateDocumentUpload } from "./documentUpload";

describe("application document uploads", () => {
  it("accepts a small PDF payload and sanitizes its storage filename", () => {
    const pdfBytes = Buffer.from("%PDF-1.4 fake content for Scheme Sathi", "utf8");
    const bytes = validateDocumentUpload("Income Certificate 2026.pdf", "application/pdf", pdfBytes.toString("base64"));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(safeStorageFileName("Income Certificate 2026.pdf")).toBe("income-certificate-2026.pdf");
  });

  it("rejects content that does not match its claimed mime type", () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(() => validateDocumentUpload("photo.pdf", "application/pdf", pngBytes.toString("base64"))).toThrow("looks like");
  });

  it("rejects an unsupported upload type", () => {
    expect(() => validateDocumentUpload("script.exe", "application/x-msdownload", "ZmFrZQ==")).toThrow("PDF, JPG, or PNG");
  });
});
