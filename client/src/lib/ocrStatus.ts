export type OcrStatus = "notRequested" | "processing" | "complete" | "failed";
export type OcrConfidence = "high" | "medium" | "low";
export type OcrBadgeTone = "success" | "pending" | "manual";

export function getOcrBadge(status: OcrStatus, extraction: { confidence: OcrConfidence; concerns: string[] } | null, language: "en" | "hi") {
  const copy = (english: string, hindi: string) => language === "hi" ? hindi : english;
  const needsReview = status === "failed" || (status === "complete" && (!!extraction?.concerns.length || extraction?.confidence === "low"));
  if (needsReview) return { tone: "manual" as OcrBadgeTone, label: copy("Manual review needed", "मैन्युअल जाँच आवश्यक"), nextAction: copy("Compare the preview or retry OCR.", "प्रीव्यू देखें या ओसीआर दोबारा चलाएँ।") };
  if (status === "processing") return { tone: "pending" as OcrBadgeTone, label: copy("OCR in progress", "ओसीआर जारी है"), nextAction: copy("Keep this page open while details are extracted.", "विवरण निकलने तक यह पेज खुला रखें।") };
  if (status === "notRequested") return { tone: "pending" as OcrBadgeTone, label: copy("OCR pending", "ओसीआर लंबित"), nextAction: copy("Select Extract details to begin.", "शुरू करने के लिए विवरण निकालें चुनें।") };
  return { tone: "success" as OcrBadgeTone, label: copy("Details extracted", "विवरण निकाला गया"), nextAction: copy("Compare the preview before final submission.", "अंतिम जमा करने से पहले प्रीव्यू से मिलान करें।") };
}
