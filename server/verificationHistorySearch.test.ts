import { describe, expect, it } from "vitest";
import { filterVerificationHistoryByQuery, historyPreviewFeedback } from "../client/src/lib/verificationHistory";

describe("verification history quick search", () => {
  const events = [{ documentName: "Income certificate", fileName: "income-2026.pdf", schemeName: "National Scholarship Portal", kind: "userVerified", detail: "User manually verified extracted details." }, { documentName: "Aadhaar card", fileName: "aadhaar.png", schemeName: "PM-KISAN", kind: "ocrFailed", detail: "Please retry the image extraction." }];

  it("matches document names, filenames, schemes, activity labels, and notes without changing the source event order", () => {
    expect(filterVerificationHistoryByQuery(events, "INCOME")).toEqual([events[0]]);
    expect(filterVerificationHistoryByQuery(events, "pm-kisan")).toEqual([events[1]]);
    expect(filterVerificationHistoryByQuery(events, "verified details")).toEqual([events[0]]);
    expect(filterVerificationHistoryByQuery(events, "retry")).toEqual([events[1]]);
    expect(filterVerificationHistoryByQuery(events, "")).toBe(events);
  });

  it("provides clear loading and unavailable feedback for the private hover-preview state", () => {
    expect(historyPreviewFeedback("loading")).toBe("Loading secure preview…");
    expect(historyPreviewFeedback("unavailable")).toContain("Preview unavailable");
  });
});
