import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach } from "vitest";
import { schemeCatalog } from "@shared/schemeCatalog";
import {
  consumePilotFeedbackQuota,
  PILOT_FEEDBACK_MAX_PER_WINDOW,
  PILOT_FEEDBACK_WINDOW_MS,
  resetPilotFeedbackQuotaForTest,
} from "./pilotFeedback";
import { rankScholarshipSchemes } from "./schemeMatching";

describe("scholarship pilot", () => {
  beforeEach(() => resetPilotFeedbackQuotaForTest());

  it("returns only student-focused education schemes for an eligible student profile", () => {
    const matches = rankScholarshipSchemes(
      {
        age: 18,
        state: "Maharashtra",
        caste: "General",
        annualIncome: 300000,
        occupation: "Student",
        gender: "Female",
        isStudent: false,
        isFarmer: false,
        isDisabled: false,
      },
      schemeCatalog
    );
    expect(matches.map(match => match.id)).toEqual(["nsp"]);
    expect(matches.every(match => match.category === "Education")).toBe(true);
  });

  it("limits the public pilot form and opens a fresh window after ten minutes", () => {
    const startedAt = 1_000_000;
    for (let index = 0; index < PILOT_FEEDBACK_MAX_PER_WINDOW; index += 1) {
      expect(consumePilotFeedbackQuota("pilot-ip", startedAt)).toBe(true);
    }
    expect(consumePilotFeedbackQuota("pilot-ip", startedAt)).toBe(false);
    expect(
      consumePilotFeedbackQuota(
        "pilot-ip",
        startedAt + PILOT_FEEDBACK_WINDOW_MS
      )
    ).toBe(true);
  });

  it("keeps feedback contact opt-in explicit and wires both public pilot routes", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const checker = readFileSync(
      new URL("../client/src/pages/ScholarshipChecker.tsx", import.meta.url),
      "utf8"
    );
    const pilot = readFileSync(
      new URL("../client/src/pages/PilotLanding.tsx", import.meta.url),
      "utf8"
    );
    expect(router).toContain("contactConsent");
    expect(router).toContain("submitFeedback");
    expect(checker).toContain("trpc.scholarships.checkEligibility");
    expect(pilot).toContain("trpc.pilot.submitFeedback");
  });
});
