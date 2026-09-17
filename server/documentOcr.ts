import { STANDALONE_MODE } from "./_core/env";
import { hasStandaloneLLM, invokeLLM } from "./_core/llm";

export type OcrExtraction = {
  documentType: string;
  detectedName: string | null;
  referenceNumbers: string[];
  dates: string[];
  keyDetails: string[];
  concerns: string[];
  confidence: "high" | "medium" | "low";
};

const ocrSchema = {
  type: "object",
  properties: {
    documentType: { type: "string" },
    detectedName: { type: ["string", "null"] },
    referenceNumbers: { type: "array", items: { type: "string" } },
    dates: { type: "array", items: { type: "string" } },
    keyDetails: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["documentType", "detectedName", "referenceNumbers", "dates", "keyDetails", "concerns", "confidence"],
  additionalProperties: false,
} as const;

export function normaliseOcrExtraction(value: unknown): OcrExtraction {
  const fallback: OcrExtraction = {
    documentType: "Document",
    detectedName: null,
    referenceNumbers: [],
    dates: [],
    keyDetails: [],
    concerns: ["Extraction result was unreadable; please review manually."],
    confidence: "low",
  };
  if (!value || typeof value !== "object") return fallback;
  const v = value as Partial<Record<keyof OcrExtraction, unknown>>;
  const str = (input: unknown, max: number): string => {
    if (typeof input !== "string") return "";
    return input.slice(0, max);
  };
  const strArray = (input: unknown, maxItems: number, maxLen: number): string[] => {
    if (!Array.isArray(input)) return [];
    return input
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.slice(0, maxLen))
      .slice(0, maxItems);
  };
  const confidence =
    v.confidence === "high" || v.confidence === "medium" || v.confidence === "low"
      ? v.confidence
      : "low";
  const concerns = strArray(v.concerns, 6, 360);
  return {
    documentType: str(v.documentType, 160) || "Document",
    detectedName:
      v.detectedName === null || v.detectedName === undefined
        ? null
        : str(v.detectedName, 160) || null,
    referenceNumbers: strArray(v.referenceNumbers, 8, 160),
    dates: strArray(v.dates, 8, 160),
    keyDetails: strArray(v.keyDetails, 8, 360),
    concerns:
      confidence === "low" && concerns.length === 0
        ? ["Low-confidence extraction; please review manually."]
        : concerns,
    confidence,
  };
}

export async function extractDocumentDetails(input: { signedUrl: string; mimeType: string; checklistName: string; fileName: string }) {
  // Standalone deployment without any LLM endpoint: return an honest,
  // low-confidence extraction that routes the document to manual review
  // instead of pretending an AI read it. (Platform mode always has one.)
  if (STANDALONE_MODE && !hasStandaloneLLM()) {
    return normaliseOcrExtraction({
      documentType: input.checklistName,
      detectedName: null,
      referenceNumbers: [],
      dates: [],
      keyDetails: [
        `File stored for manual review: ${input.fileName}`,
        "Automatic text extraction is not configured on this deployment.",
      ],
      concerns: [
        "AI extraction is unavailable on this deployment; review this document manually.",
      ],
      confidence: "low",
    });
  }
  const source = input.mimeType === "application/pdf"
    ? [{ type: "text", text: `Checklist item: ${input.checklistName}. File name: ${input.fileName}. Extract only visible text. Never infer missing information. This is a private user document.` }, { type: "file_url", file_url: { url: input.signedUrl, mime_type: "application/pdf" } }]
    : [{ type: "text", text: `Checklist item: ${input.checklistName}. File name: ${input.fileName}. Extract only visible text. Never infer missing information. This is a private user document.` }, { type: "image_url", image_url: { url: input.signedUrl, detail: "high" } }];
  const response = await invokeLLM({
    model: "gemini-3-flash-preview",
    messages: [
      { role: "system", content: "You perform private document OCR. Report extracted details for user review only. Do not claim legal validity, identity verification, or eligibility. If unreadable, add a concern and use low confidence." },
      { role: "user", content: source as any },
    ],
    response_format: { type: "json_schema", json_schema: { name: "document_ocr", strict: true, schema: ocrSchema } },
    maxTokens: 1400,
  });
  const content = response.choices[0]?.message.content;
  if (!content || typeof content !== "string") throw new Error("OCR returned no structured result");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OCR returned an unreadable result; please retry or review manually");
  }
  return normaliseOcrExtraction(parsed);
}
