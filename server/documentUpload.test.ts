import { describe, expect, it } from "vitest";
import { safeStorageFileName, validateDocumentUpload } from "./documentUpload";

describe("application document uploads", () => {
  it("accepts a small PDF payload and sanitizes its storage filename", () => {
    const bytes = validateDocumentUpload("Income Certificate 2026.pdf", "application/pdf", Buffer.from("pdf content").toString("base64"));
    expect(bytes.toString()).toBe("pdf content");
    expect(safeStorageFileName("Income Certificate 2026.pdf")).toBe("income-certificate-2026.pdf");
  });

  it("rejects an unsupported upload type", () => {
    expect(() => validateDocumentUpload("script.exe", "application/x-msdownload", "ZmFrZQ==")).toThrow("PDF, JPG, or PNG");
  });
});
