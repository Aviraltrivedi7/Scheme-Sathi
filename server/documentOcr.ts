import { invokeLLM } from "./_core/llm";

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

export function normaliseOcrExtraction(value: OcrExtraction): OcrExtraction {
  return {
    documentType: value.documentType.slice(0, 160),
    detectedName: value.detectedName?.slice(0, 160) ?? null,
    referenceNumbers: value.referenceNumbers.slice(0, 8).map((item) => item.slice(0, 160)),
    dates: value.dates.slice(0, 8).map((item) => item.slice(0, 160)),
    keyDetails: value.keyDetails.slice(0, 8).map((item) => item.slice(0, 360)),
    concerns: value.concerns.slice(0, 6).map((item) => item.slice(0, 360)),
    confidence: value.confidence,
  };
}

export async function extractDocumentDetails(input: { signedUrl: string; mimeType: string; checklistName: string; fileName: string }) {
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
  return normaliseOcrExtraction(JSON.parse(content) as OcrExtraction);
}
