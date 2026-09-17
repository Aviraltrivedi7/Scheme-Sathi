const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = 8_000_000;
const allowedMimeTypes = new Map([
  ["application/pdf", ["pdf"]],
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
]);

function sniffMimeType(bytes: Buffer): "application/pdf" | "image/jpeg" | "image/png" | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  return null;
}

export function validateDocumentUpload(fileName: string, mimeType: string, base64Data: string) {
  if (!fileName.trim() || fileName.length > 180) throw new Error("Choose a valid document filename.");
  if (!allowedMimeTypes.has(mimeType)) throw new Error("Upload a PDF, JPG, or PNG file only.");
  if (typeof base64Data !== "string" || !base64Data.length || base64Data.length > MAX_BASE64_CHARS) throw new Error("Document must be between 1 byte and 5 MB.");
  // Reject characters outside the base64 alphabet early (Buffer.from silently skips them).
  if (/[^A-Za-z0-9+/=\s]/.test(base64Data)) throw new Error("Document data is corrupted. Please re-select the file.");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64Data, "base64");
  } catch {
    throw new Error("Document data is corrupted. Please re-select the file.");
  }
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Document must be between 1 byte and 5 MB.");
  const sniffed = sniffMimeType(bytes);
  if (!sniffed) throw new Error("File content does not look like a PDF, JPG, or PNG. Please re-select the file.");
  if (sniffed !== mimeType) throw new Error(`File content looks like ${sniffed === "application/pdf" ? "a PDF" : sniffed === "image/png" ? "a PNG" : "a JPG"}, but was sent as ${mimeType}. Please re-select the file.`);
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const allowedExts = allowedMimeTypes.get(mimeType) ?? [];
  if (!ext || !allowedExts.includes(ext)) throw new Error(`File extension .${ext || "?"} does not match the selected file type. Use ${allowedExts.map((e) => `.${e}`).join(", ")}.`);
  return bytes;
}

export function safeStorageFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}
