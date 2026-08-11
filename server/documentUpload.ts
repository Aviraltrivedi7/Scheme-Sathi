const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function validateDocumentUpload(fileName: string, mimeType: string, base64Data: string) {
  if (!fileName.trim() || fileName.length > 180) throw new Error("Choose a valid document filename.");
  if (!allowedMimeTypes.has(mimeType)) throw new Error("Upload a PDF, JPG, or PNG file only.");
  const bytes = Buffer.from(base64Data, "base64");
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Document must be between 1 byte and 5 MB.");
  return bytes;
}

export function safeStorageFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}
