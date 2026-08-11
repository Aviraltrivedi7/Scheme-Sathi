import { describe, expect, it } from "vitest";
import { getOcrBadge } from "../client/src/lib/ocrStatus";

describe("OCR status badges", () => {
  it("maps a clean complete OCR result to the green success state", () => {
    expect(getOcrBadge("complete", { confidence: "high", concerns: [] }, "en")).toMatchObject({ tone: "success", label: "Details extracted" });
  });

  it("maps unrequested and processing OCR work to amber pending states", () => {
    expect(getOcrBadge("notRequested", null, "en").tone).toBe("pending");
    expect(getOcrBadge("processing", null, "hi")).toMatchObject({ tone: "pending", label: "ओसीआर जारी है" });
  });

  it("maps failures, low confidence, and concerns to the red manual-review state", () => {
    expect(getOcrBadge("failed", null, "en").tone).toBe("manual");
    expect(getOcrBadge("complete", { confidence: "low", concerns: [] }, "en").tone).toBe("manual");
    expect(getOcrBadge("complete", { confidence: "medium", concerns: ["Unreadable stamp"] }, "en").tone).toBe("manual");
  });
});
