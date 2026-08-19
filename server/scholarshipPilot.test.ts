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
    expect(matches.map(match => match.id)).toContain("nsp");
    expect(matches.length).toBeGreaterThanOrEqual(20);
    expect(matches.every(match => match.category === "Education")).toBe(true);
  });

  it("adds 30 to 50 official-directory scholarship records with a traceable source", () => {
    const officialDirectoryRecords = schemeCatalog.filter(
      scheme => scheme.verificationStatus === "officialDirectory"
    );
    expect(officialDirectoryRecords.length).toBeGreaterThanOrEqual(30);
    expect(officialDirectoryRecords.length).toBeLessThanOrEqual(50);
    expect(
      officialDirectoryRecords.every(
        scheme => scheme.category === "Education" && scheme.sourceUrl === "https://scholarships.gov.in/All-Scholarships"
      )
    ).toBe(true);
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
    const inbox = readFileSync(
      new URL("../client/src/pages/PilotAdmin.tsx", import.meta.url),
      "utf8"
    );
    const discover = readFileSync(
      new URL("../client/src/pages/Discover.tsx", import.meta.url),
      "utf8"
    );
    const attribution = readFileSync(
      new URL("../client/src/components/CohortSignupAttribution.tsx", import.meta.url),
      "utf8"
    );
    expect(router).toContain("contactConsent");
    expect(router).toContain("submitFeedback");
    expect(checker).toContain("trpc.scholarships.checkEligibility");
    expect(pilot).toContain("trpc.pilot.submitFeedback");
    expect(pilot).toContain("trpc.pilot.cohort");
    expect(pilot).toContain("trpc.pilot.trackCohortVisit");
    expect(pilot).toContain("pendingPilotCohortKey");
    expect(inbox).toContain("trpc.admin.pilot.feedback.list");
    expect(inbox).toContain("trpc.admin.pilot.cohorts.create");
    expect(inbox).toContain("trpc.admin.pilot.cohorts.conversionStats");
    expect(attribution).toContain("trpc.pilot.recordCohortSignup");
    expect(attribution).toContain("sessionStorage.removeItem");
    expect(discover).toContain('discoverLabel("providerArea", language)');
    expect(discover).toContain('discoverLabel("sourceStatus", language)');
    expect(discover).toContain("value=\"provider\"");
  });
});
